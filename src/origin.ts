/**
 * Implements communications with external or remote galleries and
 * any functionality that has to do with local gallery access,
 * control and modifications.
 */

import * as vscode from "vscode";
import * as yaml from "yaml";
import { createWriteStream } from "fs";
import {
  Log,
  PROJECT_CONFIG_FILENAME,
  PROJECT_BATCHCONFIG_FILENAME,
  hasValidFileExtension,
  isValidPath,
  canonical,
  letOpenGallery,
  asUint8Array,
  getContent,
} from "./globals";
import Axios from "axios";
/* eslint-disable @typescript-eslint/naming-convention */

import {
  addIndex,
  getIndex,
  getIndexFile,
  IndexMenu,
  IndexMenuJson,
} from "./indexing";

export interface GalleryConfig {
  project_name: string;
  repository_url: string;
  user_content_version: string;
  description: string;
  favicon: string;
  gallery_parameters_path: string;
}

export interface BatchGalleryConfig {
  projectName: string;
  galleryConfigs: string[];
  favicon?: string;
}

interface ImageParameter {
  image_path: string;
  celltype: string;
  css: string;
  code: string;
}

interface PlywoodMetadata {
  plywood_gallery_core_version: string;
}

export type GalleryParameters = {
  plywood_metadata: PlywoodMetadata;
  plywood_content: { [category: string]: ImageParameter[] };
};

export class Project {
  constructor(
    private readonly extensionUri: vscode.Uri,
    public readonly config: GalleryConfig,
    public readonly parameters: GalleryParameters,
    public readonly previewImage: vscode.Uri,
    public readonly index: IndexMenu
  ) {}

  get iconPath() {
    return this.index.isExternal
      ? localDirectoryOf(
          this.extensionUri,
          this.config.project_name,
          this.config.favicon.split("/").pop()
        )
      : vscode.Uri.joinPath(
          vscode.Uri.file(this.index.galleryConfigFp),
          `../${this.config.favicon}`
        );
  }

  imagePath(imagePath: string) {
    return this.index.isExternal
      ? localDirectoryOf(
          this.extensionUri,
          this.config.project_name,
          imagePath.split("/").pop()
        )
      : vscode.Uri.joinPath(
          vscode.Uri.file(this.index.galleryConfigFp),
          `../${imagePath}`
        );
  }
}

/**
 * Returns true if the runtime check on the provided object having
 * all the keys specified.
 *
 * @param conf
 * @returns
 */
export function isValidConfig(conf: any, mustKeys: string[]) {
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
export async function fetchLocalConfig(fileUri: vscode.Uri) {
  if (!isValidPath(fileUri.fsPath, true)) {
    vscode.window.showErrorMessage(
      `FileNotFound: Couldn't find the gallery configuration at ${fileUri.fsPath}.`
    );
    return;
  }
  const confFile = await vscode.workspace.fs.readFile(fileUri);
  const yamlObj = yaml.parse(confFile.toString()) as GalleryConfig;
  return yamlObj;
}

export async function remoteHasBatchConfig(remoteRootDir: string) {
  try {
    const res = await Axios.get(
      `${remoteRootDir}/${PROJECT_BATCHCONFIG_FILENAME}`
    );
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

export async function fetchRemoteConfigFromBatch(
  extensionUri: vscode.Uri,
  remoteRootDir: string
) {
  const contentUrl = `${remoteRootDir}/${PROJECT_BATCHCONFIG_FILENAME}`;
  Log.info(
    `Fetching entry batch configuration from content url "${contentUrl}"`
  );
  const res = await getContent(contentUrl, "batch gallery configuration");
  if (!res) {
    return;
  }
  Log.info(
    `Content successfully fetched with status ${res.status}: ${res.statusText}`
  );
  const yamlObj = yaml.parse(res.data) as BatchGalleryConfig;
  if (!isValidConfig(yamlObj, ["galleryConfigs"])) {
    vscode.window.showErrorMessage(
      Log.error(
        "The batch gallery configuration for this repository has an invalid structure."
      )
    );
    return;
  }
  const choices: { [category: string]: GalleryConfig } = {};
  for (let addon in yamlObj.galleryConfigs) {
    const conf = await fetchRemoteConfig(extensionUri, remoteRootDir, {
      contentAddon: addon,
    });
    if (!conf) {
      return;
    }
    choices[conf.project_name] = conf;
  }
  const chosenPrj = await vscode.window.showQuickPick(Object.keys(choices), {
    title: "Select a gallery to download from the batch repository.",
  });
  if (chosenPrj) {
    return choices[chosenPrj];
  }
}

/**
 * Downloads the html_configuration.yaml file from the remote repository
 * and writes onto the local subdirectory.
 *
 * @param extensionUri
 * @param rawRootRepoUrl The raw.usercontent github URL to the directory root
 * @returns GalleryParams
 */
export async function fetchRemoteConfig(
  extensionUri: vscode.Uri,
  rawRootRepoUrl: string,
  options: { contentAddon?: string; errorOut?: boolean } = {
    contentAddon: PROJECT_CONFIG_FILENAME,
    errorOut: true,
  }
) {
  const contentUrl = `${rawRootRepoUrl}/${
    options.contentAddon || PROJECT_CONFIG_FILENAME
  }`;

  Log.info(`Fetching entry configuration from content url "${contentUrl}"`);
  return getContent(contentUrl, "gallery configuration", {
    errorOut: options.errorOut,
  }).then((res) => {
    if (!res) {
      return;
    }
    Log.info(
      `Content successfully fetched with status ${res.status}: ${res.statusText}`
    );
    const yamlObj = yaml.parse(res.data) as GalleryConfig;
    if (
      !isValidConfig(yamlObj, [
        "project_name",
        "repository_url",
        "user_content_version",
        "description",
        "gallery_parameters_path",
      ])
    ) {
      vscode.window.showErrorMessage(
        Log.error(
          "The gallery configuration for this repository has an invalid structure."
        )
      );
      return;
    }
    const cacheDir = cacheDirectoryOf(
      extensionUri,
      yamlObj.project_name,
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
 * Returns a Uri to the cache repository of the gallery.
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
 * Moves the gallery folder from the cache directory to the
 * local directory.
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
    await removeProjectFolder(localDir);
  }
  return vscode.workspace.fs
    .copy(cacheDir, localDir)
    .then(() => removeProjectFolder(cacheDir));
}

async function downloadGalleryImage(
  extensionUri: vscode.Uri,
  imgDestUrl: string,
  projectName: string,
  imgName: string,
  reportDownloaded: any
) {
  var resolve: any;
  var reject: any;
  const r = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
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
      ).on("finish", () => {
        reportDownloaded(imgName, true);
        resolve();
      });
      res.data.pipe(writeStream);
    })
    .catch((reason) => {
      Log.error(`A following image has failed to be downloaded for ${reason}.`);
      reportDownloaded(imgName, false);
      reject();
    });
  return r;
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
  var projectName = config.project_name;
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
  const paramUrl = `${remoteRootUrl}/${config.gallery_parameters_path}`;
  Log.info(`Fetching gallery parameters from URL ${paramUrl}.`);
  const res = await getContent(paramUrl, "gallery parameters");
  if (!res) {
    return;
  }
  if (config.favicon) {
    const iconUrl = `${remoteRootUrl}/${config.favicon}`;
    Log.info(`Fetching gallery favicon from URL ${iconUrl}.`);
    const ico = await getContent(iconUrl, "gallery favicon", {
      responseType: "arraybuffer",
    });
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
  Log.info(
    `Fetching assets from remote ${res.config.url} with status code ${res.status}`
  );
  if (res.status !== 200) {
    vscode.window.showErrorMessage(
      Log.error(
        `${res.statusText}: ${res.status}\nCouldn't fetch Gallery Parameters.`
      )
    );
    return;
  }

  let params: GalleryParameters = res.data;
  var imgsDownloaded = 0;

  const nImgs = Object.values(params.plywood_content)
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
      config.gallery_parameters_path.split("/").pop()
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
      message: Log.info(
        `[${imgsDownloaded}/${nImgs}] Downloading image "${imgName}".`
      ),
    });
    Log.info(
      `[${imgsDownloaded}/${nImgs}] ${
        ok ? "Succeeded" : "Failed"
      } downloading "${imgName}".`
    );
    if (imgsDownloaded === nImgs) {
      finished = true;
    }
  }

  for (var category of Object.keys(params.plywood_content)) {
    for (var param of params.plywood_content[category]) {
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
      Log.info(
        `[${imgsDownloaded}/${nImgs}] Image "${imgName}" at url "${imgDestUrl}".`
      );
      // Progress half considered finished when starting and after moved
      // will incur the other half
      progress.report({
        increment: perAssetDownload / 2,
        message: Log.info(
          `[${imgsDownloaded}/${nImgs}] Downloading image "${imgName}".`
        ),
      });
      await downloadGalleryImage(
        extensionUri,
        imgDestUrl,
        projectName,
        imgName,
        reportDownloaded
      );
    }
  }

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
              version: config.user_content_version,
              isExternal: true,
            }).then(() => {
              letOpenGallery(
                `Successfully downloaded "${projectName}".`,
                repoUrl
              );
            });
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
            reject();
            clearInterval(id);
          });
      }
    }, 3000);
  });
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
  const configDir = menu.isExternal
    ? localDirectoryOf(extensionUri, menu.projectName, PROJECT_CONFIG_FILENAME)
    : vscode.Uri.file(menu.galleryConfigFp);
  const config = await fetchLocalConfig(configDir);
  if (!config) {
    return;
  }
  const galleryParamsDir = menu.isExternal
    ? localDirectoryOf(
        extensionUri,
        menu.projectName,
        config.gallery_parameters_path.split("/").pop()
      )
    : vscode.Uri.joinPath(configDir, `../${config.gallery_parameters_path}`);

  const params: GalleryParameters = JSON.parse(
    (await vscode.workspace.fs.readFile(galleryParamsDir)).toString()
  );

  return new Project(
    extensionUri,
    config,
    params,
    localDirectoryOf(
      extensionUri,
      menu.projectName,
      params.plywood_content[
        Object.keys(params.plywood_content)[0]
      ][0].image_path
        .split("/")
        .pop()
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
  extensionUri: vscode.Uri,
  isExternal: boolean | null = null
): Promise<Project[]> {
  var galleries: Project[] = [];
  const idxMenu = await getIndexFile(extensionUri);
  for (let identifier of Object.keys(idxMenu)) {
    const prj = await getLocalGallery(extensionUri, identifier, idxMenu);
    // filter the projects returned based on the isExternal strain given
    if (prj && prj.index.isExternal === isExternal) {
      galleries.push(prj);
    }
  }
  return galleries;
}
