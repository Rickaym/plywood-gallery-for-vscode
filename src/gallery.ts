/**
 * Implements the core functionality of the gallery webview and all it's
 * correspondence.
 */

import * as vscode from "vscode";
import { checkGalleryUpdate } from "./extension";
import { getWebviewResFp, getWebviewResource, Log } from "./globals";
import { Project } from "./origin";

import { TemplateEngine } from "./templateEngine";

const safeCSSProperties = ["width", "height", "border"];
interface SafeCSS {
  width?: string;
  height?: string;
  border?: string;
}

export class Gallery {
  constructor(
    public readonly subscriptions: any[],
    private readonly extensionUri: vscode.Uri
  ) {}

  // a list of text editor schemes that won't be considered an
  // insertable document
  private static readonly disallowedSchemes = ["output"];

  onActivate() {
    vscode.window.onDidChangeActiveTextEditor(
      () => {
        if (
          !vscode.window.activeTextEditor ||
          Gallery.disallowedSchemes.includes(
            vscode.window.activeTextEditor.document.uri.scheme
          )
        ) {
          return;
        }
        this.lastActiveEditor = vscode.window.activeTextEditor;
        Log.info(
          `Current insertable text document changed to "${this.lastActiveEditor.document.fileName}"`
        );
      },
      null,
      this.subscriptions
    );
  }

  private panel?: vscode.WebviewPanel;
  private lastOpenedUri?: string;
  private lastActiveEditor?: vscode.TextEditor;
  private resource = getWebviewResource(this.extensionUri, "gallery");

  createWebView(project: Project) {
    return vscode.window.createWebviewPanel(
      "plywood-gallery",
      project.config.project_name,
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        localResourceRoots: project.index.isExternal
          ? undefined
          : [
              vscode.Uri.joinPath(vscode.Uri.file(project.index.uri), "../"),
              this.extensionUri,
            ],
        enableScripts: true,
        enableForms: false,
      }
    );
  }

  refresh() {
    if (this.panel && this.lastOpenedUri) {
      vscode.commands.executeCommand(
        "plywood-gallery.OpenGallery",
        this.lastOpenedUri
      );
    }
  }

  static extractCSSProperty(property: string, css: string) {
    const result = RegExp(`${property}\s*:\s*([^;]*);?`, "g").exec(css);
    if (result) {
      return result[1].trim();
    } else {
      return undefined;
    }
  }

  extractSafeCSS(css: string): SafeCSS {
    let style: { [k: string]: string } = {};
    safeCSSProperties.forEach((property) => {
      const value = Gallery.extractCSSProperty(property, css);
      if (value) {
        style[property] = value;
      }
    });
    return style;
  }

  /**
   * Create a new webview for a project and reveals on the sidebar.
   * If `separate === true` the panel will be created separately
   * otherwise, it will simply replace any preopened gallaries.
   *
   * @param project
   * @param separate
   */
  async show(project: Project, separate: boolean = false) {
    Log.info(`Initializing a webview for "${project.index.projectName}"`);
    if (this.panel && !separate) {
      if (
        !this.panel.webview.options.localResourceRoots &&
        !project.index.isExternal
      ) {
        this.panel.dispose();
        var panel = this.createWebView(project);
        this.panel = panel;
      } else {
        this.panel.title = project.config.project_name;
        var panel = this.panel;
      }
    } else {
      var panel = this.createWebView(project);
      this.panel = panel;
    }

    const engine = new TemplateEngine(
      panel.webview,
      this.resource,
      "gallery",
      this.extensionUri
    );

    panel.iconPath = project.iconPath;
    panel.webview.html = await engine.render({
      galleryDesc: project.config.description,
      galleryTitle: project.config.project_name,
      userContentVersion: project.config.user_content_version,
      destination: project.index.isExternal ? "Remote" : "Local",
    });
    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "update":
            checkGalleryUpdate(this.extensionUri, project).then((status) => {
              if (!status) {
                vscode.window.showInformationMessage(
                  `${project.config.project_name} does not have any new updates!`
                );
              }
            });
            break;
          case "loaded":
            const galleryData: any = {};
            // set the tmp_webview_resource_url before posting the object
            Object.keys(project.parameters.plywood_content).forEach((title) => {
              galleryData[title] = {};
              project.parameters.plywood_content[title].forEach((imgMap) => {
                galleryData[title][
                  panel.webview
                    .asWebviewUri(project.imagePath(imgMap.image_path))
                    .toString()
                ] = { code: imgMap.code, css: this.extractSafeCSS(imgMap.css) };
              });
            });
            panel.webview.postMessage({
              command: "fill",
              data: galleryData,
            });
            break;
          case "codeInsert":
            this.insertCode(message.code);
            break;
        }
      },
      undefined,
      this.subscriptions
    );
    panel.onDidDispose(
      () => {
        Log.info(`Disposed webview for "${project.index.projectName}".`);
        if (panel === this.panel) {
          this.panel = undefined;
        }
      },
      undefined,
      this.subscriptions
    );
    this.lastOpenedUri = project.index.uri;
    Log.info(`Shown webview for "${project.index.projectName}".`);
  }

  /**
   * Fix indentations into user configured settings.
   *
   * @param code
   * @param editor
   * @returns string
   */
  static adaptiveIndent(code: string, editor: vscode.TextEditor) {
    const before = editor.document.getText(
      new vscode.Range(
        new vscode.Position(editor.selection.active.line, 0),
        editor.selection.active
      )
    );

    var tab = "\t";
    if (editor.options.insertSpaces && editor.options.tabSize) {
      if (typeof editor.options.tabSize === "string") {
        var tabSize = parseInt(editor.options.tabSize);
      } else {
        var tabSize = editor.options.tabSize;
      }
      tab = " ".repeat(tabSize);
    }
    if (!before.trim()) {
      const replacable = `\n${tab}`;
      code = code
        .replace(/\n    /g, replacable)
        .replace(/^\t/g, replacable)
        .replace(/\n/g, "\n" + before);
    }
    return code;
  }

  static getPreviousEditor() {
    if (!vscode.window.activeTextEditor) {
      vscode.commands.executeCommand("workbench.action.focusPreviousGroup");
    }
    return vscode.window.activeTextEditor;
  }

  async insertCode(code: string) {
    const lastEditor = this.lastActiveEditor
      ? this.lastActiveEditor
      : Gallery.getPreviousEditor();
    if (!lastEditor) {
      return vscode.window.showErrorMessage(
        "Select a document first and then use the gallery!"
      );
    }

    Log.info(`Inserting code into "${lastEditor.document.fileName}".`);
    code = Gallery.adaptiveIndent(code, lastEditor).trimEnd() + "\n";

    lastEditor
      .edit((e) => {
        e.insert(lastEditor.selection.active, code);
      })
      .then(() => {
        vscode.commands
          .executeCommand("workbench.action.focusPreviousGroup")
          .then(() =>
            lastEditor.revealRange(
              new vscode.Range(
                lastEditor.selection.active,
                lastEditor.selection.active
              )
            )
          );
      });
  }
}
