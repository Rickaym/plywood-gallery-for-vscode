import * as vscode from "vscode";
import {
  fetchRemoteConfig,
  fetchLocalConfig,
  fetchRemoteAssets,
} from "./origin";
import { Log } from "./globals";

async function importRemoteCommand(context: vscode.ExtensionContext) {
  const url = await vscode.window.showInputBox({
    title: "Raw GitHub Url",
    value:
      "https://raw.githubusercontent.com/kolibril13/plywood-gallery/main/docs/",
  });
  if (!url) {
    return;
  }
  Log.info(`Preparing to pull from remote repository ${url}`);
  const config = await fetchRemoteConfig(context.extensionUri, url);
  if (!config) {
    return;
  }
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Fetching remote GitHub gallery",
      cancellable: true,
    },
    (progress, token) =>
      fetchRemoteAssets(context.extensionUri, url, config, progress, token)
  );
}

async function importLocalCommand(context: vscode.ExtensionContext) {
  const url = await vscode.window.showInputBox({
    title: "Local Url",
  });
  if (url) {
    fetchLocalConfig(context.extensionUri, vscode.Uri.file(url));
  }
}

export function activate(context: vscode.ExtensionContext) {
  Log.info("Plywood Gallery is active!");
  context.subscriptions.push(
    vscode.commands.registerCommand("plywood-gallery.ImportRemote", () => {
      importRemoteCommand(context);
    }),
    vscode.commands.registerCommand("plywood-gallery.ImportLocal", () => {
      importLocalCommand(context);
    })
  );
}

export function deactivate() {}
