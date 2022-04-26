import * as vscode from "vscode";
import { getLocalProjects, Project } from "./origin";

export class GalleryTreeItem extends vscode.TreeItem {
  constructor(
    private extensionUri: vscode.Uri,
    public readonly name: string,
    public readonly project?: Project
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    if (this.project) {
      this.contextValue = "gallery";
      this.description = `v${this.project.config.userContentVersion}`;
      this.tooltip = this.project.config.repositoryUrl;
      this.command = {
        title: "Plywood Gallery: Open a gallery webview.",
        command: "plywood-gallery.Open",
        arguments: [this.label],
      };
      this.iconPath = vscode.Uri.joinPath(
        this.extensionUri,
        "assets/photo-gallery.png"
      );
    } else {
      this.contextValue = "chapter";
    }
  }
}

export class InstalledGalleriesExplorerProvider
  implements vscode.TreeDataProvider<GalleryTreeItem>
{
  constructor(private extensionUri: vscode.Uri) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    GalleryTreeItem | undefined | void
  > = new vscode.EventEmitter<GalleryTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    GalleryTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  getTreeItem(element: GalleryTreeItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
		this._onDidChangeTreeData.fire();
	}

  async getChildren(element?: GalleryTreeItem): Promise<GalleryTreeItem[]> {
    if (element) {
      if (!element.project) {
        return Promise.resolve([]);
      } else {
        return Promise.resolve(
          Object.keys(element.project.parameters).map(
            (name) => new GalleryTreeItem(this.extensionUri, name)
          )
        );
      }
    } else {
      return getLocalProjects(this.extensionUri).then((projects) =>
        projects.map(
          (prj) =>
            new GalleryTreeItem(this.extensionUri, prj.config.projectName, prj)
        )
      );
    }
  }
}
