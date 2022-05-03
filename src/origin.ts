/**
 * Implements communications with external or remote galleries and
 * any functionality that has to do with local gallery access,
 * control and modifications.
*/

import * as vscode from "vscode";
import * as yaml from "yaml";
import { createWriteStream, mkdirSync } from "fs";
import {
  Log,
  PROJECT_CONFIG_FILENAME,
  hasValidFileExtension,
  isValidPath,
  reformatObject,
  canonical,
  letOpenGallery,
  asUint8Array,
  getContent,
} from "./globals";
import Axios from "axios";
import { addIndex, getIndex, getIndexFile, IndexMenu, IndexMenuJson } from "./indexing";

export interface GalleryConfig {
  projectName: string;
  repositoryUrl: string;
  userContentVersion: string;
  description: string;
  favicon: string;
  customFooter: string;
  galleryParametersPath: string;
}

interface ImageParameter {
  image_path: string;
  celltype: string;
  css: string;
  code: string;
}

export type GalleryParams = { [category: string]: ImageParameter[] };

/**
 * Returns true if the runtime check on the provided object having
 * all the keys specified.
 *
 * @param conf
 * @returns
 */
export function isValidConfig(conf: any) {
  const mustKeys = [
    "projectName",
    "repositoryUrl",
    "userContentVersion",
    "description",
    "galleryParametersPath",
  ];
  const confgKeys = Object.keys(conf);
  if (!mustKeys.every((key) => confgKeys.includes(key))) {
    return false;
  } else {
    return true;
  }
}

/**
 * Fetches the local html_configuration file with the same project name
 * if it exists.
 *
 * @param fileUri
 */
export async function fetchLocalConfig(
  extensionUri: vscode.Uri,
  fileUri: vscode.Uri
) {
  if (!isValidPath(fileUri.fsPath, true)) {
    vscode.window.showErrorMessage(
      `FileNotFound: Couldn't find the gallery configuration at ${fileUri.fsPath}.`
    );
    return;
  }
  const confFile = await vscode.workspace.fs.readFile(fileUri);
  const yamlObj = reformatObject<GalleryConfig>(
    yaml.parse(confFile.toString())
  );
  return yamlObj;
}

/**
 * Downloads the html_configuration.yaml file from the remote repository
 * and writes onto the local subdirectory.
 *
 * @param extensionUri
 * @param remoteRootDir
 * @returns GalleryParams
 */
export async function fetchRemoteConfig(
  extensionUri: vscode.Uri,
  remoteRootDir: string
) {
  const contentUrl = `${remoteRootDir}/${PROJECT_CONFIG_FILENAME}`;
  Log.info(`Fetching entry configuration from content url "${contentUrl}"`);
  return getContent(contentUrl, "gallery configuration").then((res) => {
    if (!res) {
      return;
    }
    Log.info(
      `Content successfully fetched with status ${res.status}: ${res.statusText}`
    );
    const yamlObj = reformatObject<GalleryConfig>(yaml.parse(res.data));
    if (!isValidConfig(yamlObj)) {
      vscode.window.showErrorMessage(
        Log.error(
          "The gallery configuration for this repository has an invalid structure."
        )
      );
      return;
    }
    const cacheDir = cacheDirectoryOf(
      extensionUri,
      yamlObj.projectName,
      PROJECT_CONFIG_FILENAME
    );
    vscode.workspace.fs.writeFile(
      cacheDir,
      asUint8Array(yaml.stringify(yamlObj))
    );
    Log.info(`Cached remote configuration..`);
    return yamlObj;
  });
}

/**
 * Create a project folder if and only if it dos not exist.
 *
 * @param projectFolderPath
 */
function createProjectFolder(projectFolderPath: vscode.Uri) {
  if (!isValidPath(projectFolderPath.fsPath, false)) {
    mkdirSync(projectFolderPath.fsPath, {
      recursive: true,
    });
  }
}

/**
 * Remove the downloaded project folder.
 *
 * @param projectFolderPath
 */
export async function removeProjectFolder(projectFolderPath: vscode.Uri) {
  return vscode.workspace.fs.delete(projectFolderPath, {
    recursive: true,
  });
}

/**
 * Returns a Uri to the local repository of the gallery.
 *
 * @param extensionUri
 * @param galleryName
 */
export function localDirectoryOf(
  extensionUri: vscode.Uri,
  galleryName: string,
  filename: string = ""
) {
  return vscode.Uri.joinPath(
    extensionUri,
    "local",
    canonical(galleryName),
    filename
  );
}

/**
 * Returns a Uri to the cache repository of the gallery.
 *
 * @param extensionUri
 * @param galleryName
 * @returns
 */
export function cacheDirectoryOf(
  extensionUri: vscode.Uri,
  galleryName: string,
  filename: string = ""
) {
  return vscode.Uri.joinPath(
    extensionUri,
    "cache",
    canonical(galleryName),
    filename
  );
}

/**
 * Moves the gallery folder from the cache directory to the
 * local directory.
 *
 * @param extensionUri
 * @param galleryName
 */
async function moveCacheToLocal(extensionUri: vscode.Uri, galleryName: string) {
  const cacheDir = cacheDirectoryOf(extensionUri, galleryName);
  if (!isValidPath(cacheDir.fsPath, false)) {
    const msg =
      "Operation failed, the cache folder has been emptied before saved.";
    Log.error(msg);
    vscode.window.showErrorMessage(msg);
    throw Error(msg);
  }
  const localDir = localDirectoryOf(extensionUri, galleryName);
  if (isValidPath(localDir.fsPath, false)) {
    removeProjectFolder(localDir);
  }
  return vscode.workspace.fs
    .copy(cacheDir, localDir)
    .then(() => removeProjectFolder(cacheDir));
}

/**
 * Stream all the gallery assets into a local subdirectory with the given
 * configuration.
 *
 * @param extensionUri
 * @param remoteRootUrl
 * @param config
 * @param progress
 * @returns
 */
export async function fetchRemoteAssets(
  extensionUri: vscode.Uri,
  remoteRootUrl: string,
  repoUrl: string,
  config: GalleryConfig,
  progress: vscode.Progress<any>,
  token: vscode.CancellationToken
) {
  var cancelled = false;
  var finished = false;
  var projectName = config.projectName;
  token.onCancellationRequested(() => {
    Log.info("User request cancelltion for remote asset fetching.");
    cancelled = true;
    finished = true;
    removeProjectFolder(cacheDirectoryOf(extensionUri, projectName));
  });

  progress.report({
    increment: 5,
    message: Log.info(`Downloading gallery parameters.`),
  });
  const paramUrl = `${remoteRootUrl}/${config.galleryParametersPath}`;
  Log.info(`Fetching gallery parameters from URL ${paramUrl}.`);
  const res = await getContent(paramUrl, "gallery parameters");
  if (!res) {
    return;
  }
  if (config.favicon) {
    const iconUrl = `${remoteRootUrl}/${config.favicon}`;
    Log.info(`Fetching gallery favicon from URL ${iconUrl}.`);
    const ico = await getContent(iconUrl, "gallery favicon", "arraybuffer");
    if (!ico) {
      return;
    }
    await vscode.workspace.fs.writeFile(
      cacheDirectoryOf(
        extensionUri,
        projectName,
        config.favicon.split("/").pop()
      ),
      ico.data
    );
  }
  Log.error(`Fetching assets from remote ${res.config.url}`);
  if (res.status !== 200) {
    vscode.window.showErrorMessage(
      Log.error(
        `${res.statusText}: ${res.status}\nCouldn't fetch Gallery Parameters.`
      )
    );
    return;
  }

  let params: GalleryParams = res.data;
  var imgsDownloaded = 0;

  const nImgs = Object.values(params)
    .map((arr) => arr.length)
    .reduce((a, b) => a + b, 0);

  // 80 points for asset download
  // 10 points for downloading gallery params
  // 10 points for moving from cache to local
  const perAssetDownload = 80 / nImgs;
  await vscode.workspace.fs.writeFile(
    cacheDirectoryOf(
      extensionUri,
      projectName,
      config.galleryParametersPath.split("/").pop()
    ),
    asUint8Array(JSON.stringify(params))
  );
  progress.report({
    increment: 5,
    message: Log.info(`Gallery parameters downloaded.`),
  });
  if (cancelled) {
    return;
  }
  function reportDownloaded(imgName: string, ok: boolean) {
    imgsDownloaded += 1;
    progress.report({
      increment: perAssetDownload / 2,
      message: ok
        ? Log.info(
            `[${imgsDownloaded}/${nImgs}] Image "${imgName}" downloaded.`
          )
        : Log.error(
            `[${imgsDownloaded}/${nImgs}] Image "${imgName}" fail to download.`
          ),
    });
    if (imgsDownloaded === nImgs) {
      finished = true;
    }
  }
  Object.keys(params).forEach((category) => {
    params[category].forEach((param) => {
      const imgPath = param.image_path;
      const imgName = imgPath.split("/").pop();
      if (!imgName) {
        Log.error(
          `Image name specified in of ${imgPath} is invalid, skipping.`
        );
        return;
      }
      if (!hasValidFileExtension(imgName)) {
        progress.report({
          increment: perAssetDownload,
          message: Log.info(
            `Skipped "${imgName}" for having an impaired file extension.`
          ),
        });
        return;
      }
      if (cancelled) {
        return;
      }
      const imgDestUrl = `${remoteRootUrl}/${imgPath}`;
      // Progress half considered finished when starting and after moved
      // will incur the other half
      progress.report({
        increment: perAssetDownload / 2,
        message: Log.info(`Downloading image "${imgName}".`),
      });
      Log.info(`Image destination URL is "${imgDestUrl}"`);

      Axios.get(imgDestUrl, {
        responseType: "stream",
      })
        .then((res) => {
          if (res.status !== 200) {
            vscode.window.showErrorMessage(
              `${res.statusText}: ${res.status}\nCouldn't download "${imgName}" file.`
            );
            removeProjectFolder(cacheDirectoryOf(extensionUri, projectName));
            return;
          }
          const writeStream = createWriteStream(
            cacheDirectoryOf(extensionUri, projectName, imgName).fsPath
          )
            .on("finish", () => reportDownloaded(imgName, true))
            .on("close", () => {
              if (cancelled) {
                writeStream.destroy();
              }
            });
          res.data.pipe(writeStream);
        })
        .catch((reason) => {
          Log.error(
            `A following image has failed to be downloaded for ${reason}.`
          );
          reportDownloaded(imgName, false);
        });
    });
  });
  return new Promise<void>((resolve, reject) => {
    let id = setInterval(() => {
      if (cancelled) {
        resolve();
        clearInterval(id);
      } else if (finished) {
        finished = false;
        progress.report({
          increment: 5,
          message: Log.info(
            `Attempting to move cached download "${projectName}" into local.`
          ),
        });
        moveCacheToLocal(extensionUri, projectName)
          .then(() => {
            progress.report({
              increment: 5,
              message: Log.info(
                `Finished fetching remote GitHub gallery "${projectName}". You can cancel this message!`
              ),
            });
            addIndex(extensionUri, projectName, {
              galleryConfigFp: "local",
              projectName: projectName,
              uri: repoUrl,
              version: config.userContentVersion,
              isExternal: true
            });
            letOpenGallery(
              `Successfully downloaded "${projectName}".`,
              projectName
            );
            vscode.commands.executeCommand("plywood-gallery.Refresh");
            resolve();
            clearInterval(id);
          })
          .catch((reason) => {
            Log.info(
              `Failed fetching remote GitHub gallery "${projectName}" for ${reason}.`
            );
            progress.report({
              increment: 5,
              message:
                `Failed fetching remote GitHub gallery "${projectName}".` +
                ' Check the output channel "Plywood Gallery" for more information',
            });
            vscode.window.showErrorMessage(
              `Failed to download "${projectName}".`
            );
            resolve();
            clearInterval(id);
          });
      }
    }, 3000);
  });
}

export class Project {
  constructor(
    private readonly extensionUri: vscode.Uri,
    public readonly config: GalleryConfig,
    public readonly parameters: GalleryParams,
    public readonly previewImage: vscode.Uri,
    public readonly index: IndexMenu
  ) {}

  get iconPath() {
    return this.index.isExternal
      ? localDirectoryOf(
          this.extensionUri,
          this.config.projectName,
          this.config.favicon.split("/").pop()
        )
      : vscode.Uri.joinPath(
          vscode.Uri.file(this.index.galleryConfigFp),
          `./../${this.config.favicon}`
        );
  }

  imagePath(imagePath: string) {
    return this.index.isExternal
      ? localDirectoryOf(
          this.extensionUri,
          this.config.projectName,
          imagePath.split("/").pop()
        )
      : vscode.Uri.joinPath(
          vscode.Uri.file(this.index.galleryConfigFp),
          `./../${imagePath}`
        );
  }
}

/**
 * Returns a Project object if the given identifer is audited
 * in the index file and all it's separate components can be fetched.
 *
 * @param extensionUri
 * @param identifier
 * @param idxMenuJson
 * @returns
 */
export async function getLocalGallery(
  extensionUri: vscode.Uri,
  identifier: string,
  idxMenuJson?: IndexMenuJson
) {
  const menu = await getIndex(extensionUri, identifier, idxMenuJson);
  const configDir =
    menu.isExternal
      ? localDirectoryOf(
          extensionUri,
          menu.projectName,
          PROJECT_CONFIG_FILENAME
        )
      : vscode.Uri.file(menu.galleryConfigFp);
  const config = await fetchLocalConfig(extensionUri, configDir);
  if (!config) {
    return;
  }
  const galleryParamsDir =
    menu.isExternal
      ? localDirectoryOf(
          extensionUri,
          menu.projectName,
          config.galleryParametersPath.split("/").pop()
        )
      : vscode.Uri.joinPath(configDir, `./../${config.galleryParametersPath}`);

  const params: GalleryParams = JSON.parse(
    (await vscode.workspace.fs.readFile(galleryParamsDir)).toString()
  );

  return new Project(
    extensionUri,
    config,
    params,
    localDirectoryOf(
      extensionUri,
      menu.projectName,
      params[Object.keys(params)[0]][0].image_path.split("/").pop()
    ),
    menu
  );
}

/**
 * A short hand to getting all the galleries listed in the
 * index file.
 *
 * @param extensionUri
 * @returns
 */
export async function getAllLocalGalleries(
  extensionUri: vscode.Uri
): Promise<Project[]> {
  var galleries: Project[] = [];
  const idxMenu = await getIndexFile(extensionUri);
  for (let identifier of Object.keys(idxMenu)) {
    const prj = await getLocalGallery(extensionUri, identifier, idxMenu);
    if (prj) {
      galleries.push(prj);
    }
  }
  return galleries;
}