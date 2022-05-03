/**
 * Implements all the indexing related book-keeping of local
 * and downloaded repositories.
 */

import * as vscode from "vscode";
import { asUint8Array } from "./globals";
import { localDirectoryOf, removeProjectFolder } from "./origin";


export type IndexMenuJson = { [n: string]: IndexMenu };

export interface IndexMenu {
  uri: string;
  galleryConfigFp: string;
  projectName: string;
  version: string;
  isExternal: boolean;
}

async function saveIndexFile(fp: vscode.Uri, payload: string) {
  return vscode.workspace.fs.writeFile(fp, asUint8Array(payload));
}

/**
 * Returns a JSON object of the local gallery index file
 *
 * Mapping:
 *  Identifier -> IndexMenu(Object)
 *
 * @param extensionUri
 * @returns
 */
export async function getIndexFile(
  extensionUri: vscode.Uri
): Promise<IndexMenuJson> {
  const idxFp = localDirectoryOf(extensionUri, "index.json");
  return vscode.workspace.fs.readFile(idxFp).then((val) => {
    return JSON.parse(val.toString());
  });
}

/**
 * Returns an IndexMenu object of the given identifier.
 * An optional IndexMenuJson parmeter can be passed to avoid
 * having to read the index file.
 *
 * @param extensionUri
 * @param identifier
 * @param indexMenuJson
 * @returns
 */
export async function getIndex(
  extensionUri: vscode.Uri,
  identifier: string,
  indexMenuJson?: IndexMenuJson
): Promise<IndexMenu> {
  if (!indexMenuJson) {
    indexMenuJson = await getIndexFile(extensionUri);
  }
  return indexMenuJson[identifier];
}

export async function addIndex(
  extensionUri: vscode.Uri,
  projectName: string,
  menu: IndexMenu
) {
  return getIndexFile(extensionUri).then((idx) => {
    idx[menu.uri ? menu.uri : projectName] = menu;
    return saveIndexFile(
      localDirectoryOf(extensionUri, "index.json"),
      JSON.stringify(idx)
    );
  });
}

export async function removeIndex(
  extensionUri: vscode.Uri,
  identifier: string
) {
  return getIndexFile(extensionUri).then((idxMenu) => {
    const menu = idxMenu[identifier];
    delete idxMenu[identifier];
    saveIndexFile(
      localDirectoryOf(extensionUri, "index.json"),
      JSON.stringify(idxMenu)
    );
    if (menu.isExternal) {
      return removeProjectFolder(
        localDirectoryOf(extensionUri, identifier)
      ).then(() => vscode.commands.executeCommand("plywood-gallery.Refresh"));
    } else {
      return vscode.commands.executeCommand("plywood-gallery.Refresh");
    }
  });
}
