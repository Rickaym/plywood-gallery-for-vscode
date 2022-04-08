import * as vscode from "vscode";
import * as fs from "fs";

import { parse, stringify } from "yaml";
import { TextEncoder } from "util";

import Axios from "axios";

interface HtmlConfig {
  projectName: string;
  repositoryUrl: string;
  userContentVersion: string;
  description: string;
  favicon: string;
  customFooter: string;
  gallaryParametersPath: string;
}

interface ImageParameter {
  imagePath: string;
  celltype: string;
  css: string;
  code: string;
}

type GalleryParams = { [category: string]: ImageParameter[] };

/**
 * Fetches the local html_configuration file with the same project name
 * if it exists.
 *
 * @param extensionUri
 * @param projectName
 */
export async function fetchLocalConfig(
  extensionUri: vscode.Uri,
  projectName: string
) {}

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
  const res = await Axios.get(remoteRootDir + "html_configuration.yaml");
  if (res.status !== 200) {
    vscode.window.showErrorMessage(
      `${res.statusText}: ${res.status}\nCouldn't fetch remote configuration.`
    );
    return;
  }
  const yamlObj: HtmlConfig = parse(res.data);

  vscode.workspace.fs.writeFile(
    cacheDirectoryOf(extensionUri, yamlObj.projectName),
    new TextEncoder().encode(stringify(yamlObj))
  );

  //fs.mkdir(vscode.Uri.joinPath(extensionUri, `locale/${yamlObj.title}`));
  return yamlObj;
}

/**
 * Generate a fs-path friendly name identifier with the submitted project name.
 * This identifier is used in caching downloaded images, saving them and
 * as a primary key.
 *
 * @param projectName
 * @returns
 */
export function nameIdentifierOf(projectName: string) {
  return projectName.toLowerCase().replace(" ", "_");
}

/**
 * This directory is used as a temporary cache repository during the download.
 *
 * @param extensionUri
 * @param projectName
 * @returns
 */
function cacheDirectoryOf(extensionUri: vscode.Uri, projectName: string) {
  return vscode.Uri.joinPath(
    extensionUri,
    `cache/${nameIdentifierOf(projectName)}`
  );
}

/**
 * This directory is used as a final local repository for all successfuly
 * asset downloads.
 *
 * @param extensionUri
 * @param projectName
 * @returns
 */
function localDirectoryOf(extensionUri: vscode.Uri, projectName: string) {
  return vscode.Uri.joinPath(
    extensionUri,
    `local/${nameIdentifierOf(projectName)}`
  );
}

/**
 * Remove the download cache directory for the project name.
 *
 * @param extensionUri
 * @param projectName
 */
export async function removeDownloadCache(
  extensionUri: vscode.Uri,
  projectName: string
) {
  vscode.workspace.fs.delete(cacheDirectoryOf(extensionUri, projectName), {
    recursive: true,
  });
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
export async function fetchRemote(
  extensionUri: vscode.Uri,
  remoteRootDir: string,
  config: HtmlConfig,
  progress: vscode.Progress<any>
) {
  const res = await Axios.get(remoteRootDir + config.gallaryParametersPath);
  if (res.status !== 200) {
    vscode.window.showErrorMessage(
      `${res.statusText}: ${res.status}\nCouldn't fetch Gallery Parameters.`
    );
    return;
  }
  const params: GalleryParams = JSON.parse(res.data);
  const nImgs = Object.values(params)
    .map((arr) => arr.length)
    .reduce((a, b) => a + b, 0);

  // 10 points of the progress bar is reserved for cache to
  // private folder subdirectory file movement action
  const incr = 90 / nImgs;

  Object.keys(params).forEach((category) => {
    params[category].forEach((param) => {
      const imgName = param.imagePath.split("/").pop();
      progress.report({
        increment: incr,
        message: `Downloading gallery item ${imgName}..`,
      });

      Axios.get(remoteRootDir + param.imagePath, {
        responseType: "stream",
      }).then((res) => {
        if (res.status !== 200) {
          vscode.window.showErrorMessage(
            `${res.statusText}: ${res.status}\nCouldn't download '${imgName}' file.`
          );
          return;
        }
        res.data.pipe(
          fs.createWriteStream(
            vscode.Uri.joinPath(cacheDirectoryOf(extensionUri, projectName))
          )
        );
        // CONTINUE HERE
      });
    });
  });
}
