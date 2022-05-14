/**
 * Implements the gallery TreeView on the activity bar as well as the
 * currently beta WebView integrated TreeView.
*/

import * as vscode from "vscode";
import {
  getWebviewResFp,
  getWebviewResource,
  WebviewResources,
} from "./globals";
import { getAllLocalGalleries, Project } from "./origin";
import { TemplateEngine } from "./templateEngine";

function tabularize(
  htmlDoc: string,
  project: Project,
  webview: vscode.Webview
) {
  return TemplateEngine.trueRender(htmlDoc, {
    galleryPreviewImagePath: webview.asWebviewUri(project.previewImage),
    galleryTitle: project.config.projectName,
    galleryDesc: project.config.description.replace(new RegExp("\n", "g"), " "),
  });
}

export class HubWebviewProvider implements vscode.WebviewViewProvider {
  constructor(private ctx: vscode.ExtensionContext) {}

  private resource: WebviewResources = getWebviewResource(
    this.ctx.extensionUri,
    "hub"
  );

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewView.webview.options = { enableScripts: true };
    let engine = new TemplateEngine(webviewView.webview, this.resource);
    let hubItemDoc = (
      await vscode.workspace.fs.readFile(
        getWebviewResFp(this.ctx.extensionUri, "hub", "html", "hub_item")
      )
    ).toString();
    let hubItemsStr = (await getAllLocalGalleries(this.ctx.extensionUri))
      .map((p) => tabularize(hubItemDoc, p, webviewView.webview))
      .join("\n");

    webviewView.webview.html = await engine.render({
      version: "0.0.1",
      hubItems: hubItemsStr,
    });
  }
}

export class GalleryTreeItem extends vscode.TreeItem {
  constructor(
    private extensionUri: vscode.Uri,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly name: string,
    public readonly project: Project,
    public readonly type: string
  ) {
    super(name, collapsibleState);
    if (this.isGallery()) {
      this.description = `v${this.project.config.userContentVersion}`;
      this.tooltip = this.project.index.uri;
      this.command = {
        title: "Plywood Gallery: Open a gallery webview.",
        command: "plywood-gallery.OpenGallery",
        arguments: [this.project.index.uri],
      };
      if (this.project.config.favicon) {
        this.iconPath = this.project.iconPath;
      } else {
        this.iconPath = vscode.Uri.joinPath(
          this.extensionUri,
          "assets/photo-gallery.png"
        );
      }
    } else if (type === "chapter") {
      this.description = `${project.parameters[name].length} items`;
      this.iconPath = new vscode.ThemeIcon("book");
    } else {
      this.iconPath = new vscode.ThemeIcon("code");
    }
  }

  contextValue = this.type;

  isGallery() {
    return ["gitGallery", "internalGallery"].includes(this.type);
  }

  getChapters() {
    if (this.isGallery()) {
      return Object.keys(this.project.parameters).map(
        (name) =>
          new GalleryTreeItem(
            this.extensionUri,
            vscode.TreeItemCollapsibleState.Collapsed,
            name,
            this.project,
            "chapter"
          )
      );
    } else if (this.type === "chapter") {
      return this.project.parameters[this.name].map((sect) => {
        const lastPart = sect.image_path.split("/");
        return new GalleryTreeItem(
          this.extensionUri,
          vscode.TreeItemCollapsibleState.None,
          lastPart[lastPart.length - 1].replace(".png", ""),
          this.project,
          "section"
        );
      });
    } else {
      return [];
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
      return Promise.resolve(element.getChapters());
    } else {
      return getAllLocalGalleries(this.extensionUri).then((projects) =>
        projects.map(
          (prj) =>
            new GalleryTreeItem(
              this.extensionUri,
              vscode.TreeItemCollapsibleState.Collapsed,
              prj.config.projectName,
              prj,
              prj.index.isExternal ? "gitGallery" : "internalGallery"
            )
        )
      );
    }
  }
}
