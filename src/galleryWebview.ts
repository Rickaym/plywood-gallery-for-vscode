import * as vscode from "vscode";
import {
  getWebviewResource, WebviewResources
} from "./globals";

import { TemplateEngine } from "./templateEngine";


export class Gallery {
  constructor(public readonly ctx: vscode.ExtensionContext) {}

  private iconPath = {
    dark: vscode.Uri.joinPath(this.ctx.extensionUri, ""),
    light: vscode.Uri.joinPath(this.ctx.extensionUri, ""),
  };

  private lastActiveEditor: vscode.TextEditor | undefined;

  private loads: WebviewResources = getWebviewResource(
    this.ctx.extensionUri,
    "gallery"
  );

  async show() {
    // let engine = new TemplateEngine("templates/gallery", this.ctx.extensionUri);
    // let panel = vscode.window.createWebviewPanel(
    //   "plywood-gallery",
    //   "Plywood Gallery",
    //   {
    //     viewColumn: vscode.ViewColumn.Beside,
    //     preserveFocus: true,
    //   },
    //   {
    //     enableScripts: true,
    //   }
    // );
    // let galleryObjectsStr = "";
    // panel.iconPath = this.iconPath;
    // let htmlDoc = await engine.render({
    //   cspSource: panel.webview.cspSource,
    //   " gallery.js": panel.webview.asWebviewUri(this.loads.js).toString(),
    //   " gallery.css": panel.webview.asWebviewUri(this.loads.css).toString(),
    //   extIssue: "https://github.com/kolibril13/mobject-gallery/issues",
    //   galleryIssue: "https://github.com/kolibril13/mobject-gallery/issues",
    //   galleryObjects: galleryObjectsStr,
    //   nonce: getNonce(),
    //   version: "0.0.1",
    // });
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
