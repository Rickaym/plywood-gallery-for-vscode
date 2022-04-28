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
import { loadPackageJson, Log, PACKAGE_JSON } from "./globals";
import { Gallery } from "./gallery";
import {
  GalleryTreeItem,
  HubWebviewProvider,
  InstalledGalleriesExplorerProvider,
} from "./hub";

async function importRemoteCommand(ctx: vscode.ExtensionContext) {
  let branch = "main";
  let urlInput = await vscode.window.showInputBox({
    title: "Raw GitHub Url (you can prefix an optional branch)",
    placeHolder: "main:https://github.com/Rickaym/Plywood-Gallery-For-VSCode",
    value: "https://github.com/kolibril13/plywood-gallery-minimal-example/",
  });
  if (!urlInput) {
    return;
  }
  var url = urlInput.trim();
  if (urlInput.includes(":") && urlInput.split(":").length - 1 === 2) {
    const segs = urlInput.split(":");
    if (segs[1]) {
      branch = segs[0];
      url = segs[1];
    }
  }
  if (url.endsWith("/")) {
    url = url.slice(0, url.length - 1);
  }
  url = `${url}/${branch}`;
  Log.info(`Preparing to pull from raw content base repository ${url}`);
  const config = await fetchRemoteConfig(ctx.extensionUri, url, branch);
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
      fetchRemoteAssets(
        ctx.extensionUri,
        url.replace("github.com", "raw.githubusercontent.com"),
        config,
        progress,
        token
      )
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
  gallery: Gallery,
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
    gallery.show(choice);
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

export function activate(ctx: vscode.ExtensionContext) {
  Log.info("Plywood Gallery is active!");
  // Enables beta installed galleries
  loadPackageJson(ctx.extensionUri).then(() => {
    if (
      PACKAGE_JSON.activationEvents.includes("onView:beta-installed-galleries")
    ) {
      const igp = new HubWebviewProvider(ctx);
      vscode.window.registerWebviewViewProvider(
        "beta-installed-galleries",
        igp
      );
    }
  });

  const treeViewProvider = new InstalledGalleriesExplorerProvider(
    ctx.extensionUri
  );
  vscode.window.registerTreeDataProvider(
    "installed-galleries",
    treeViewProvider
  );
  const gallery = new Gallery(ctx);
  ctx.subscriptions.push(
    vscode.commands.registerCommand("plywood-gallery.ImportRemote", () => {
      importRemoteCommand(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.ImportLocal", () => {
      importLocalCommand(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.Open", (...args) => {
      openGalleryCommand(ctx, gallery, ...args);
    }),
    vscode.commands.registerCommand("plywood-gallery.ClearCache", () => {
      clearCacheCommand(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.Reset", () => {
      resetCommand(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.Refresh", () => {
      treeViewProvider.refresh();
    }),
    vscode.commands.registerCommand(
      "plywood-gallery.RemoveGallery",
      (...args) => {
        removeGalleryCommand(ctx, ...args);
      }
    )
  );
}

export function deactivate() {}
