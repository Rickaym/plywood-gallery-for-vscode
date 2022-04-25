import * as vscode from "vscode";
import { getWebviewResource, WebviewResources } from "./globals";
import { localDirectoryOf, Project } from "./origin";

import { TemplateEngine } from "./templateEngine";

export class Gallery {
  constructor(
    public readonly ctx: vscode.ExtensionContext,
    public readonly project: Project
  ) {}

  private resource: WebviewResources = getWebviewResource(
    this.ctx.extensionUri,
    "gallery"
  );

  private lastActiveEditor: vscode.TextEditor | undefined;

  async show() {
    const panel = vscode.window.createWebviewPanel(
      "plywood-gallery",
      "Plywood Gallery",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        enableScripts: true,
      }
    );
    let engine = new TemplateEngine(
      panel,
      this.resource,
      this.ctx.extensionUri
    );
    let galleryObjs = "";

    Object.keys(this.project.parameters).forEach((title) => {
      galleryObjs += `<h2>${title}</h2>`;
      this.project.parameters[title].forEach((imgMap) => {
        const code = imgMap.code.replace(/"/g, "'");
        galleryObjs += `<img class="image-button" src=${panel.webview.asWebviewUri(
          localDirectoryOf(
            this.ctx.extensionUri,
            this.project.config.projectName,
            imgMap.image_path.split("/").pop()
          )
        )} alt="${code}">`;
      });
    });

    panel.iconPath = this.resource.icon;
    panel.webview.html = await engine.render({
      extIssue: "https://github.com/kolibril13/mobject-gallery/issues",
      galleryIssue: "https://github.com/kolibril13/mobject-gallery/issues",
      galleryObjects: galleryObjs,
      version: "0.0.1",
    });

    panel.webview.onDidReceiveMessage(
      (message) => {
        if (
          message.command === "update" ||
          message.command === "download-again"
        ) {
          return;
        } else {
          this.insertCode(message.code);
        }
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

  // async update() {
  //   let remoteConf = await fetchRemoteConfig(extensionUri, remoteRootDir);
  //   if (!remoteConf) {
  //     return;
  //   }
  //   let localConf = await fetchLocalConfig(
  //     extensionUri,
  //     nameIdentifierOf(remoteConf.projectName)
  //   );
  //   if (!yaml) {
  //   }
  // }
}
