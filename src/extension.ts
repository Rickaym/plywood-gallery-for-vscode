import * as vscode from "vscode";
import {
  fetchRemoteConfig,
  fetchLocalConfig,
  fetchRemoteAssets,
  removeProjectFolder,
  cacheDirectoryOf,
  localDirectoryOf,
  getLocalProjects,
} from "./origin";
import { Log } from "./globals";
import { Gallery } from "./gallery";
import { GalleryTreeItem, InstalledGalleriesExplorerProvider } from "./hub";

async function importRemoteCommand(ctx: vscode.ExtensionContext) {
  const url = await vscode.window.showInputBox({
    title: "Raw GitHub Url",
    value:
      "https://raw.githubusercontent.com/kolibril13/plywood-gallery/main/docs/",
  });
  if (!url) {
    return;
  }
  Log.info(`Preparing to pull from remote repository ${url}`);
  const config = await fetchRemoteConfig(ctx.extensionUri, url);
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
      fetchRemoteAssets(ctx.extensionUri, url, config, progress, token)
  );
}

async function importLocalCommand(ctx: vscode.ExtensionContext) {
  const url = await vscode.window.showInputBox({
    title: "Local Url",
  });
  if (url) {
    fetchLocalConfig(ctx.extensionUri, vscode.Uri.file(url));
  }
}

async function openGalleryCommand(
  ctx: vscode.ExtensionContext,
  projectName?: string
) {
  const projects = await getLocalProjects(ctx.extensionUri);
  if (!projectName) {
    projectName = await vscode.window.showQuickPick(
      projects.map((p) => p.config.projectName),
      { title: "Choose a gallery to open" }
    );
    if (!projectName) {
      return;
    }
  }
  const choice = projects.find((p) => p.config.projectName === projectName);
  if (!choice) {
    vscode.window.showErrorMessage("Couldn't find the gallery you've chosen.");
    return;
  } else {
    new Gallery(ctx, choice).show();
  }
}

async function clearCacheCommand(ctx: vscode.ExtensionContext) {
  removeProjectFolder(cacheDirectoryOf(ctx.extensionUri, ""));
  Log.info("Removed entire cache folder due to user request.");
}

async function resetCommand(ctx: vscode.ExtensionContext) {
  Log.info("User requested entire reset.");
  removeProjectFolder(cacheDirectoryOf(ctx.extensionUri, ""));
  Log.info("Removed entire cache folder due to user request.");
  removeProjectFolder(localDirectoryOf(ctx.extensionUri, ""));
  Log.info("Removed local project folders due to user request.");
}

async function removeGalleryCommand(
  ctx: vscode.ExtensionContext,
  gallery?: GalleryTreeItem
) {
  vscode.window.showWarningMessage("This method has not been implemented");
}

export function activate(context: vscode.ExtensionContext) {
  Log.info("Plywood Gallery is active!");
  const igp = new InstalledGalleriesExplorerProvider(context.extensionUri);
  vscode.window.registerTreeDataProvider("installed-galleries", igp);
  context.subscriptions.push(
    vscode.commands.registerCommand("plywood-gallery.ImportRemote", () => {
      importRemoteCommand(context);
    }),
    vscode.commands.registerCommand("plywood-gallery.ImportLocal", () => {
      importLocalCommand(context);
    }),
    vscode.commands.registerCommand("plywood-gallery.Open", (...args) => {
      openGalleryCommand(context, ...args);
    }),
    vscode.commands.registerCommand("plywood-gallery.ClearCache", () => {
      clearCacheCommand(context);
    }),
    vscode.commands.registerCommand("plywood-gallery.Reset", () => {
      resetCommand(context);
    }),
    vscode.commands.registerCommand("plywood-gallery.Refresh", () => {
      igp.refresh();
    }),
    vscode.commands.registerCommand(
      "plywood-gallery.RemoveGallery",
      (...args) => {
        removeGalleryCommand(context, ...args);
      }
    )
  );
}

export function deactivate() {}
