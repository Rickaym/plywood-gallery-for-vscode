import * as vscode from "vscode";

import * as yaml from "yaml";
import { TextEncoder } from "util";
import { createWriteStream, mkdirSync } from "fs";
import {
  Log,
  PROJECT_CONFIG_FILENAME,
  hasValidFileExtension,
  isValidPath,
  reformatObject,
  canonical,
} from "./globals";

import Axios from "axios";

export interface HtmlConfig {
  projectName: string;
  repositoryUrl: string;
  userContentVersion: string;
  description: string;
  favicon: string;
  customFooter: string;
  gallaryParametersPath: string;
}

interface ImageParameter {
  image_path: string;
  celltype: string;
  css: string;
  code: string;
}

export type GalleryParams = { [category: string]: ImageParameter[] };

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
  const yamlObj = reformatObject<HtmlConfig>(yaml.parse(confFile.toString()));
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
  const res = await Axios.get(
    new URL(PROJECT_CONFIG_FILENAME, remoteRootDir).href
  );
  if (res.status !== 200) {
    vscode.window.showErrorMessage(
      `${res.statusText}: ${res.status}\nCouldn't fetch remote configuration.`
    );
    return;
  }
  const yamlObj = reformatObject<HtmlConfig>(yaml.parse(res.data));
  const cacheDir = cacheDirectoryOf(
    extensionUri,
    yamlObj.projectName,
    PROJECT_CONFIG_FILENAME
  );
  vscode.workspace.fs.writeFile(
    cacheDir,
    new TextEncoder().encode(yaml.stringify(yamlObj))
  );
  Log.info(`Cached remote configuration..`);
  return yamlObj;
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
  vscode.workspace.fs.delete(projectFolderPath, {
    recursive: true,
  });
}

/**
 * This directory is used as a final local repository for all successfuly
 * asset downloads.
 *
 * @param extensionUri
 * @param projectName
 */
export function localDirectoryOf(
  extensionUri: vscode.Uri,
  projectName: string,
  filename: string = ""
) {
  return vscode.Uri.joinPath(
    extensionUri,
    "local",
    canonical(projectName),
    filename
  );
}

/**
 * This directory is used as a temporary cache repository during the download.
 *
 * @param extensionUri
 * @param projectName
 * @returns
 */
export function cacheDirectoryOf(
  extensionUri: vscode.Uri,
  projectName: string,
  filename: string = ""
) {
  return vscode.Uri.joinPath(
    extensionUri,
    "cache",
    canonical(projectName),
    filename
  );
}

/**
 * Move the project folder from the cache directory to the local directory.
 *
 * @param extensionUri
 * @param projectName
 */
async function moveCacheToLocal(extensionUri: vscode.Uri, projectName: string) {
  const cacheDir = cacheDirectoryOf(extensionUri, projectName);
  if (!isValidPath(cacheDir.fsPath, false)) {
    const msg =
      "Operation failed, the cache folder has been emptied before saved.";
    Log.error(msg);
    vscode.window.showErrorMessage(msg);
    throw Error(msg);
  }
  const localDir = localDirectoryOf(extensionUri, projectName);
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
 * @param remoteRootDir
 * @param config
 * @param progress
 * @returns
 */
export async function fetchRemoteAssets(
  extensionUri: vscode.Uri,
  remoteRootDir: string,
  config: HtmlConfig,
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
  const res = await Axios.get(remoteRootDir + config.gallaryParametersPath);

  Log.error(`Fetching assets from remote ${res.config.url}.`);
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
    cacheDirectoryOf(extensionUri, projectName, config.gallaryParametersPath.split("/").pop()),
    new TextEncoder().encode(JSON.stringify(params))
  );
  progress.report({
    increment: 5,
    message: Log.info(`Gallery parameters downloaded.`),
  });
  if (cancelled) {
    return;
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
      // Progress half considered finished when starting and after moved
      // will incur the other half
      progress.report({
        increment: perAssetDownload / 2,
        message: Log.info(`Downloading image "${imgName}".`),
      });
      Axios.get(remoteRootDir + imgPath, {
        responseType: "stream",
      }).then((res) => {
        if (res.status !== 200) {
          vscode.window.showErrorMessage(
            `${res.statusText}: ${res.status}\nCouldn't download '${imgName}' file.`
          );
          removeProjectFolder(cacheDirectoryOf(extensionUri, projectName));
          return;
        }
        res.data.pipe(
          createWriteStream(
            cacheDirectoryOf(extensionUri, projectName, imgName).fsPath
          ).on("finish", () => {
            imgsDownloaded += 1;
            progress.report({
              increment: perAssetDownload / 2,
              message: Log.info(`Image "${imgName}" downloaded.`),
            });
            if (imgsDownloaded === nImgs) {
              finished = true;
            }
          })
        );
      });
    });
  });
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      if (finished) {
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
            resolve();
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
            resolve();
          });
      } else {
        reject();
      }
    }, 60000);
  });
}

export async function fetchLocalAssets() {}
