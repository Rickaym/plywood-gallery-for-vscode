import * as vscode from "vscode";
import { fetchRemoteConfig } from "./origin";

export function activate(context: vscode.ExtensionContext) {
  console.log("Plywood Gallery is active.");

  context.subscriptions.push(
    vscode.commands.registerCommand("plywood-gallery.Tests", () => {
      fetchRemoteConfig(
        context.extensionUri,
        "https://raw.githubusercontent.com/kolibril13/plywood-gallery/main/docs/"
      );
    })
  );
}

export function deactivate() {}
