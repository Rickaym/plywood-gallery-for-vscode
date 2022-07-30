import * as vscode from "vscode";
import {
  fetchRemoteConfig,
  fetchLocalConfig,
  fetchRemoteAssets,
  removeProjectFolder,
  cacheDirectoryOf,
  GalleryConfig,
  getLocalGallery,
  remoteHasBatchConfig,
  fetchRemoteConfigFromBatch,
  Project,
  getAllLocalGalleries,
} from "./origin";
import { addIndex, removeIndex, getIndexFile, getIndex } from "./indexing";
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
  RecommendedGalleriesProvider
} from "./hub";

async function importRemote(
  ctx: vscode.ExtensionContext,
  rootPerm: boolean = false,
  forceReimport: boolean = false
) {
  let urlInput = await vscode.window.showInputBox({
    title: "GitHub Url (<optional>branch:repo-url)",
    placeHolder: "main:https://github.com/Rickaym/Plywood-Gallery-For-VSCode",
    value: "https://github.com/kolibril13/plywood-gallery-minimal-example/",
  });
  if (!urlInput) {
    return;
  } else {
    var repoUrl = urlInput;
  }
  let url = prepareRepoUrl(urlInput);
  if (
    !rootPerm &&
    !url.startsWith("https://raw.githubusercontent.com/kolibril13")
  ) {
    vscode.window.showErrorMessage(
      Log.info("You cannot download this gallery for security reasons.")
    );
    return;
  }
  Log.info(`Preparing to pull from raw content base repository ${url}`);

  if (await remoteHasBatchConfig(url)) {
    var dlConfig = await fetchRemoteConfigFromBatch(ctx.extensionUri, url);
  } else {
    var dlConfig = await fetchRemoteConfig(ctx.extensionUri, url);
  }
  if (!dlConfig) {
    return;
  }
  const config = dlConfig;
  if (
    Object.keys(await getIndexFile(ctx.extensionUri)).includes(repoUrl) &&
    !forceReimport &&
    !(await approveRedundantImport())
  ) {
    return;
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

async function getApproval(msg: string) {
  const response = await vscode.window.showWarningMessage(
    msg,
    "Continue",
    "Cancel"
  );
  return response === "Continue";
}

async function approveRedundantImport() {
  return getApproval(
    "You're trying to reimport a pre-existing gallery, do you want to proceed?"
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
      fetchLocalConfig(fileUri).then(async (conf) => {
        if (!conf) {
          return;
        }
        const idxFile = await getIndexFile(ctx.extensionUri);
        if (
          (await getIndex(ctx.extensionUri, fileUri.fsPath, idxFile)) &&
          !(await approveRedundantImport())
        ) {
          return;
        }
        addIndex(
          ctx.extensionUri,
          fileUri.fsPath,
          {
            galleryConfigFp: fileUri.fsPath,
            projectName: conf.project_name,
            uri: fileUri.fsPath,
            version: conf.user_content_version,
            isExternal: false,
          },
          idxFile
        ).then(() => {
          letOpenGallery(
            `Successfully imported local gallery "${conf.project_name}".`,
            fileUri.fsPath
          );
        });
      });
    });
}

async function openGallery(
  ctx: vscode.ExtensionContext,
  gallery: Gallery,
  prjIdentifier?: string
) {
  const projects = await getIndexFile(ctx.extensionUri);
  if (!prjIdentifier) {
    prjIdentifier = await getProjectChoice(
      ctx.extensionUri,
      "Choose a gallery to open",
      Object.values(projects).map((v) => v.projectName)
    );
    if (!prjIdentifier) {
      return;
    }
  }
  getLocalGallery(ctx.extensionUri, prjIdentifier, projects).then((choice) => {
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
  } else if (gallery.project) {
    identifier = gallery.project.index.uri;
  } else {
    vscode.window.showErrorMessage(
      `You cannot remove this tree item type "${gallery.type}"!`
    );
    return;
  }
  removeIndex(ctx.extensionUri, identifier);
}

async function update(extensionUri: vscode.Uri, config: GalleryConfig) {
  vscode.window
    .showInformationMessage(
      `Gallery "${config.project_name}" has a new update!`,
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
            title: `Updating gallery ${config.project_name}`,
            cancellable: true,
          },
          (progress, token) =>
            fetchRemoteAssets(
              extensionUri,
              "",
              prepareRepoUrl(config.repository_url),
              config,
              progress,
              token
            )
        );
      }
    });
}

export async function checkGalleryUpdate(
  extensionUri: vscode.Uri,
  project: Project
): Promise<boolean> {
  const rootUrl = prepareRepoUrl(project.config.repository_url);
  const config = await fetchRemoteConfig(extensionUri, rootUrl);

  if (
    config &&
    config.user_content_version !== project.config.user_content_version
  ) {
    update(extensionUri, config);
    return true;
  } else {
    return false;
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

  let rootPerm = false;
  const gallery = new Gallery(ctx.subscriptions, ctx.extensionUri);
  gallery.onActivate();
  const installedGalleriesTreeView = new InstalledGalleriesExplorerProvider(
    ctx.extensionUri
  );
  const recommendedGalleriesTreeView = new RecommendedGalleriesProvider(
    ctx.extensionUri
  );

  vscode.window.registerTreeDataProvider(
    "installed-galleries",
    installedGalleriesTreeView
  );
  vscode.window.registerTreeDataProvider(
    "recommended-galleries",
    recommendedGalleriesTreeView
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      "plywood-gallery.ImportRemote",
      (...args) => {
        importRemote(ctx, rootPerm, ...args);
      }
    ),
    vscode.commands.registerCommand("plywood-gallery.ImportLocal", () => {
      importLocal(ctx);
    }),
    vscode.commands.registerCommand(
      "plywood-gallery.OpenGallery",
      (...args) => {
        openGallery(ctx, gallery, ...args);
      }
    ),
    vscode.commands.registerCommand("plywood-gallery.ClearCache", () => {
      clearCache(ctx);
    }),
    vscode.commands.registerCommand("plywood-gallery.Refresh", () => {
      installedGalleriesTreeView.refresh();
      gallery.refresh();
    }),
    vscode.commands.registerCommand(
      "plywood-gallery.CheckGalleryUpdate",
      (gallery?: GalleryTreeItem) => {
        if (!gallery || !gallery.project) {
          // If a gallery object is not specified, the command is intended
          // to check all updates for all remote repos.
          getAllLocalGalleries(ctx.extensionUri, false).then((projects) => {
            projects.forEach((proj) =>
              checkGalleryUpdate(ctx.extensionUri, proj)
            );
          });
        } else {
          checkGalleryUpdate(ctx.extensionUri, gallery.project).then(
            (status) => {
              if (!status) {
                vscode.window.showInformationMessage(
                  `${gallery.name} does not have any new updates!`
                );
              }
            }
          );
        }
      }
    ),
    vscode.commands.registerCommand(
      "plywood-gallery.RemoveGallery",
      (...args) => {
        removeGallery(ctx, ...args);
      }
    ),
    vscode.commands.registerCommand("plywood-gallery.ShowOutput", () => {
      LOGGER.show(true);
    }),
    vscode.commands.registerCommand("plywood-gallery.Root", async () => {
      if (
        await getApproval(
          "Are you sure about this? Enabling root permissions will not caution when downloading potentially malicious galleries."
        )
      ) {
        rootPerm = true;
      }
    })
  );
  vscode.commands.executeCommand("plywood-gallery.CheckGalleryUpdate");
}

export function deactivate() {}
