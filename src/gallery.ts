/**
 * Implements the core functionality of the gallery webview and all it's
 * correspondence.
 */

import * as vscode from "vscode";
import { getWebviewResFp, getWebviewResource } from "./globals";
import { Project } from "./origin";

import { TemplateEngine } from "./templateEngine";

export class Gallery {
  constructor(
    public readonly subscriptions: any[],
    private readonly extensionUri: vscode.Uri
  ) {}

  onActivate() {
    vscode.window.onDidChangeActiveTextEditor(
      () => {
        if (vscode.window.activeTextEditor) {
          if (
            this.lastActiveEditor &&
            this.lastActiveEditor.document.fileName !==
              vscode.window.activeTextEditor.document.fileName
          ) {
            this.lastActiveEditor = vscode.window.activeTextEditor;
          }
        }
      },
      null,
      this.subscriptions
    );
  }

  private panel: vscode.WebviewPanel | undefined;
  private resource = getWebviewResource(this.extensionUri, "gallery");

  private lastActiveEditor: vscode.TextEditor | undefined;

  async show(project: Project) {
    if (this.panel) {
      this.panel.title = project.config.projectName;
      var panel = this.panel;
    } else {
      var panel = vscode.window.createWebviewPanel(
        "plywood-gallery",
        project.config.projectName,
        {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: true,
        },
        {
          localResourceRoots: project.index.isExternal
            ? undefined
            : [vscode.Uri.file(project.index.uri)],
          enableScripts: true,
          enableForms: false,
        }
      );
      this.panel = panel;
    }
    this.panel.iconPath = project.iconPath;

    let engine = new TemplateEngine(panel.webview, this.resource);
    let galleryItemDoc = (
      await vscode.workspace.fs.readFile(
        getWebviewResFp(this.extensionUri, "gallery", "html", "img_item")
      )
    ).toString();
    let galleryObjs = Object.keys(project.parameters)
      .map((title) => {
        return `<h2>${title}</h2>\n${project.parameters[title]
          .map((imgMap) => {
            const code = imgMap.code.replace(/"/g, "'");
            const imgPath = project.imagePath(imgMap.image_path);
            return TemplateEngine.trueRender(galleryItemDoc, {
              imgSrc: panel.webview.asWebviewUri(imgPath),
              imgCode: code,
            });
          })
          .join("\n")}`;
      })
      .join("\n");

    panel.iconPath = this.resource.icon;
    panel.webview.html = await engine.render({
      galleryObjects: galleryObjs,
      galleryDesc: project.config.description,
      galleryTitle: project.config.projectName,
      galleryFooter: project.config.customFooter,
      userContentVersion: project.config.userContentVersion,
    });
    panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === "update") {
          return;
        } else {
          this.insertCode(message.code);
        }
      },
      undefined,
      this.subscriptions
    );
    panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      undefined,
      this.subscriptions
    );
  }

  getPreviousEditor() {
    if (!vscode.window.activeTextEditor) {
      vscode.commands.executeCommand("workbench.action.focusPreviousGroup");
    }
    return vscode.window.activeTextEditor;
  }

  async insertCode(code: string) {
    const lastEditor = this.lastActiveEditor
      ? this.lastActiveEditor
      : this.getPreviousEditor();
    if (!lastEditor) {
      return vscode.window.showErrorMessage(
        "Select a document first and then use the gallery!"
      );
    }

    const before = lastEditor.document.getText(
      new vscode.Range(
        new vscode.Position(lastEditor.selection.active.line, 0),
        lastEditor.selection.active
      )
    );
    // adaptive indentations
    if (!before.trim()) {
      code = code.replace(/\n/g, "\n" + before);
    }

    lastEditor
      .edit((e) => {
        e.insert(lastEditor.selection.active, code);
      })
      .then((e) => {
        // reveal entirity of code
        lastEditor.revealRange(
          new vscode.Range(
            lastEditor.selection.active,
            lastEditor.selection.active
          )
        );
      });

    if (lastEditor.document.fileName.endsWith(".ipynb")) {
      // focusing on previous groups are a bit glitchy for notebooks in whatever
      // reason
      await vscode.commands.executeCommand(
        "workbench.action.focusPreviousGroup"
      );
    } else {
      vscode.window.showTextDocument(
        lastEditor.document,
        lastEditor.viewColumn
      );
    }
  }
}
