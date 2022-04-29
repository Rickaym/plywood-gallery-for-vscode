import * as vscode from "vscode";
import { getWebviewResource, WebviewResources } from "./globals";
import { localDirectoryOf, Project } from "./origin";

import { TemplateEngine } from "./templateEngine";

export class Gallery {
  constructor(public readonly ctx: vscode.ExtensionContext) {
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
      ctx.subscriptions
    );
  }
  private panel: vscode.WebviewPanel | undefined;
  private resource: WebviewResources = getWebviewResource(
    this.ctx.extensionUri,
    "gallery"
  );

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
          enableScripts: true,
          enableForms: false,
        }
      );
      this.panel = panel;
    }

    let engine = new TemplateEngine(panel.webview, this.resource);
    let galleryObjs = "";
    Object.keys(project.parameters).forEach((title) => {
      galleryObjs += `<h2>${title}</h2>`;
      project.parameters[title].forEach((imgMap) => {
        const code = imgMap.code.replace(/"/g, "'");
        galleryObjs += `<img class="image-button" src=${panel.webview.asWebviewUri(
          localDirectoryOf(
            this.ctx.extensionUri,
            project.config.projectName,
            imgMap.image_path.split("/").pop()
          )
        )} style="${imgMap.css}" alt="${code}">`;
      });
    });
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
      this.ctx.subscriptions
    );
    panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      undefined,
      this.ctx.subscriptions
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
        "Select a document first and then use the buttons!"
      );
    } else if (!this.lastActiveEditor) {
      this.lastActiveEditor = lastEditor;
    }

    const before = lastEditor.document.getText(
      new vscode.Range(
        new vscode.Position(lastEditor.selection.active.line, 0),
        lastEditor.selection.active
      )
    );
    // adaptive indentations
    if (!before.trim()) {
      code = `${code.replace(/\n/g, "\n" + before)}\n`;
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
