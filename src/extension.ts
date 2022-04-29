import * as vscode from "vscode";
import {
  fetchRemoteConfig,
  fetchLocalConfig,
  fetchRemoteAssets,
  removeProjectFolder,
  cacheDirectoryOf,
  localDirectoryOf,
  getLocalProjects,
  Project,
  GalleryConfig,
} from "./origin";
import {
  loadPackageJson,
  Log,
  PACKAGE_JSON,
  makeShellDirectories,
  prepareRepoUrl,
} from "./globals";
import { Gallery } from "./gallery";
import {
  GalleryTreeItem,
  HubWebviewProvider,
  InstalledGalleriesExplorerProvider,
} from "./hub";

async function importRemote(ctx: vscode.ExtensionContext) {
  let branch = "main";
  let urlInput = await vscode.window.showInputBox({
    title: "Raw GitHub Url (you can prefix an optional branch)",
    placeHolder: "main:https://github.com/Rickaym/Plywood-Gallery-For-VSCode",
    value: "https://github.com/kolibril13/plywood-gallery-minimal-example/",
  });
  if (!urlInput) {
    return;
  }
  let url = prepareRepoUrl(urlInput);
  Log.info(`Preparing to pull from raw content base repository ${url}`);
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

async function importLocal(ctx: vscode.ExtensionContext) {
  const url = await vscode.window.showInputBox({
    title: "Local Url",
  });
  if (url) {
    fetchLocalConfig(ctx.extensionUri, vscode.Uri.file(url));
  }
}

async function open(
  ctx: vscode.ExtensionContext,
  gallery: Gallery,
  projectName?: string
) {
  const projects = await getLocalProjects(ctx.extensionUri);
  if (!projectName) {
    projectName = await getProjectChoice(
      ctx.extensionUri,
      "Choose a gallery to open",
      projects
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

async function clearCache(ctx: vscode.ExtensionContext) {
  removeProjectFolder(cacheDirectoryOf(ctx.extensionUri, "")).then(() => {
    Log.info("Removed entire cache folder due to user request.");
    makeShellDirectories(ctx.extensionUri, ["local"]).then(() =>
      vscode.commands.executeCommand("plywood-gallery.Refresh")
    );
  });
}

async function reset(ctx: vscode.ExtensionContext) {
  Log.info("User requested entire reset.");
  removeProjectFolder(cacheDirectoryOf(ctx.extensionUri, "")).then(() => {
    Log.info("Removed entire cache folder due to user request.");
    removeProjectFolder(localDirectoryOf(ctx.extensionUri, "")).then(() => {
      Log.info("Removed local project folders due to user request.");
      makeShellDirectories(ctx.extensionUri, ["local", "cache"]).then(() =>
        vscode.commands.executeCommand("plywood-gallery.Refresh")
      );
    });
  });
}

async function getProjectChoice(
  extensionUri: vscode.Uri,
  prompt: string,
  projects?: Project[]
) {
  if (!projects) {
    projects = await getLocalProjects(extensionUri);
  }
  return await vscode.window.showQuickPick(
    projects.map((p) => p.config.projectName),
    { title: prompt }
  );
}

async function removeGallery(
  ctx: vscode.ExtensionContext,
  gallery?: GalleryTreeItem
) {
  var galleryName: string;
  if (!gallery) {
    const gName = await getProjectChoice(
      ctx.extensionUri,
      "Choose a gallery to remove"
    );
    if (!gName) {
      return;
    } else {
      galleryName = gName;
    }
  } else {
    galleryName = gallery.name;
  }
  removeProjectFolder(localDirectoryOf(ctx.extensionUri, galleryName)).then(
    () => vscode.commands.executeCommand("plywood-gallery.Refresh")
  );
}

async function update(extensionUri: vscode.Uri, config: GalleryConfig) {
  vscode.window
    .showInformationMessage(
      `Gallery "${config.projectName}" has a new update!`,
      "Update Now",
      "Remind Me Later"
    )
    .then((response) => {
      if (!response) {
        return;
      } else if (response === "Update Now") {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Updating gallery ${config.projectName}`,
            cancellable: true,
          },
          (progress, token) =>
            fetchRemoteAssets(
              extensionUri,
              prepareRepoUrl(config.repositoryUrl),
              config,
              progress,
              token
            )
        );
      }
    });
}

async function checkGalleryUpdate(
  ctx: vscode.ExtensionContext,
  gallery?: GalleryTreeItem
) {
  if (!gallery) {
    return;
  }
  const rootUrl = prepareRepoUrl(gallery.project.config.repositoryUrl);
  const config = await fetchRemoteConfig(ctx.extensionUri, rootUrl);
  if (!config) {
    return;
  }
  if (
    config.userContentVersion !== gallery.project.config.userContentVersion
  ) {
    update(ctx.extensionUri, config);
  }
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
      importRemote(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.ImportLocal", () => {
      importLocal(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.Open", (...args) => {
      open(ctx, gallery, ...args);
    }),
    vscode.commands.registerCommand("plywood-gallery.ClearCache", () => {
      clearCache(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.Reset", () => {
      reset(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.Refresh", () => {
      treeViewProvider.refresh();
    }),
    vscode.commands.registerCommand(
      "plywood-gallery.CheckGalleryUpdate",
      () => {
        checkGalleryUpdate(ctx);
      }
    ),
    vscode.commands.registerCommand(
      "plywood-gallery.RemoveGallery",
      (...args) => {
        removeGallery(ctx, ...args);
      }
    )
  );
}

export function deactivate() {}
