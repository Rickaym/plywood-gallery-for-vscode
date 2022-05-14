import * as vscode from "vscode";
import {
  fetchRemoteConfig,
  fetchLocalConfig,
  fetchRemoteAssets,
  removeProjectFolder,
  cacheDirectoryOf,
  localDirectoryOf,
  GalleryConfig,
  getLocalGallery,
} from "./origin";
import { addIndex, removeIndex, getIndexFile } from "./indexing";
import {
  loadPackageJson,
  Log,
  LOGGER,
  PACKAGE_JSON,
  makeShellDirectories,
  prepareRepoUrl,
  letOpenGallery,
} from "./globals";
import { Gallery } from "./gallery";
import {
  GalleryTreeItem,
  HubWebviewProvider,
  InstalledGalleriesExplorerProvider,
} from "./hub";

async function importRemote(ctx: vscode.ExtensionContext) {
  let urlInput = await vscode.window.showInputBox({
    title: "Raw GitHub Url (you can prefix an optional branch)",
    placeHolder: "main:https://github.com/Rickaym/Plywood-Gallery-For-VSCode",
    value: "https://github.com/kolibril13/plywood-gallery-minimal-example/",
  });
  if (!urlInput) {
    return;
  } else {
    var repoUrl = urlInput;
  }
  let url = prepareRepoUrl(urlInput);
  Log.info(`Preparing to pull from raw content base repository ${url}`);
  const config = await fetchRemoteConfig(ctx.extensionUri, url);
  if (!config) {
    return;
  }
  if (Object.keys(await getIndexFile(ctx.extensionUri)).includes(repoUrl)) {
    const response = await vscode.window.showWarningMessage(
      "You're trying to reimport a pre-existing gallery, do you want to proceed?",
      "Continue",
      "Cancel"
    );
    if (response !== "Continue") {
      return;
    }
  }
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Fetching remote GitHub gallery",
      cancellable: true,
    },
    (progress, token) =>
      fetchRemoteAssets(ctx.extensionUri, url, repoUrl, config, progress, token)
  );
}

async function importLocal(ctx: vscode.ExtensionContext) {
  vscode.window
    .showOpenDialog({
      canSelectMany: false,
      filters: { "Config Files": ["yaml"] },
    })
    .then((val) => {
      if (!val) {
        return;
      } else {
        var fileUri = val[0];
      }
      fetchLocalConfig(ctx.extensionUri, fileUri).then((conf) => {
        if (!conf) {
          return;
        }
        addIndex(ctx.extensionUri, fileUri.fsPath, {
          galleryConfigFp: fileUri.fsPath,
          projectName: conf.projectName,
          uri: fileUri.fsPath,
          version: conf.userContentVersion,
          isExternal: false,
        }).then(() => {
          letOpenGallery(
            `Successfully imported local gallery "${conf.projectName}".`,
            fileUri.fsPath
          );
        });
      });
    });
}

async function openGallery(
  ctx: vscode.ExtensionContext,
  gallery: Gallery,
  projectName?: string
) {
  const projects = await getIndexFile(ctx.extensionUri);
  if (!projectName) {
    projectName = await getProjectChoice(
      ctx.extensionUri,
      "Choose a gallery to open",
      Object.values(projects).map((v) => v.projectName)
    );
    if (!projectName) {
      return;
    }
  }
  getLocalGallery(ctx.extensionUri, projectName, projects).then((choice) => {
    if (!choice) {
      vscode.window.showErrorMessage(
        "Couldn't find the gallery you've chosen."
      );
      return;
    } else {
      gallery.show(choice);
    }
  });
}

async function clearCache(ctx: vscode.ExtensionContext) {
  removeProjectFolder(cacheDirectoryOf(ctx.extensionUri, "")).then(() => {
    Log.info("Removed entire cache folder due to user request.");
    makeShellDirectories(ctx.extensionUri, ["local"]).then(() =>
      vscode.commands.executeCommand("plywood-gallery.Refresh")
    );
  });
}

async function getProjectChoice(
  extensionUri: vscode.Uri,
  prompt: string,
  projectNames?: string[]
) {
  if (!projectNames) {
    projectNames = Object.values(await getIndexFile(extensionUri)).map(
      (v) => v.projectName
    );
  }
  return await vscode.window.showQuickPick(projectNames, { title: prompt });
}

async function removeGallery(
  ctx: vscode.ExtensionContext,
  gallery?: GalleryTreeItem
) {
  var identifier: string;
  if (!gallery) {
    const gName = await getProjectChoice(
      ctx.extensionUri,
      "Choose a gallery to remove"
    );
    if (!gName) {
      return;
    } else {
      identifier = gName;
    }
  } else {
    identifier = gallery.project.index.uri;
  }
  removeIndex(ctx.extensionUri, identifier);
}

async function showOutput(ctx: vscode.ExtensionContext) {
  LOGGER.show(true);
}

async function update(ctx: vscode.ExtensionContext, config: GalleryConfig) {
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
              ctx.extensionUri,
              "",
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
  if (config.userContentVersion !== gallery.project.config.userContentVersion) {
    update(ctx, config);
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
  const gallery = new Gallery(ctx.subscriptions, ctx.extensionUri);
  gallery.onActivate();
  ctx.subscriptions.push(
    vscode.commands.registerCommand("plywood-gallery.ImportRemote", () => {
      importRemote(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.ImportLocal", () => {
      importLocal(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.OpenGallery", (...args) => {
      openGallery(ctx, gallery, ...args);
    }),
    vscode.commands.registerCommand("plywood-gallery.ClearCache", () => {
      clearCache(ctx);
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
    ),
    vscode.commands.registerCommand("plywood-gallery.ShowOutput", () => {
      showOutput(ctx);
    })
  );
  vscode.commands.executeCommand("plywood-gallery.CheckGalleryUpdate");
}

export function deactivate() {}
