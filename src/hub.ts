/**
 * Implements the gallery TreeView on the activity bar as well as the
 * currently beta WebView integrated TreeView.
 */

import * as vscode from "vscode";
import {
  getContent,
  getWebviewResFp,
  getWebviewResource,
  Log,
  RECOMMENDED_GALLERY_ENLISTING_CONFIG_URL,
  WebviewResources,
} from "./globals";
import { fetchRemoteConfig, GalleryConfig, getAllLocalGalleries, Project } from "./origin";
import { TemplateEngine } from "./templateEngine";

const externalGalleryType = "gitGallery";
const internalGalleryType = "internalGallery";
const chapterType = "chapter";
const sectionType = "section";
const localCategoryType = "localListing";
const remoteCategoryType = "remoteListing";

function tabularize(
  htmlDoc: string,
  project: Project,
  webview: vscode.Webview
) {
  return TemplateEngine.trueRender(htmlDoc, {
    galleryPreviewImagePath: webview.asWebviewUri(project.previewImage),
    galleryTitle: project.config.project_name,
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
    public readonly type: string,
    public readonly project?: Project
  ) {
    super(name, collapsibleState);
    if (this.isGallery() && this.project) {
      this.description = `v${this.project.config.user_content_version}`;
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
    } else if (type === chapterType && this.project) {
      this.description = `${this.project.parameters[name].length} items`;
      this.iconPath = new vscode.ThemeIcon("book");
    } else if (type === sectionType) {
      this.iconPath = new vscode.ThemeIcon("code");
    } else if (type === remoteCategoryType) {
      this.iconPath = new vscode.ThemeIcon("github");
    } else {
      this.iconPath = new vscode.ThemeIcon("device-desktop");
    }
  }

  contextValue = this.type;

  isGallery() {
    return [externalGalleryType, internalGalleryType].includes(this.type);
  }

  isCategory() {
    return [remoteCategoryType, localCategoryType].includes(this.type);
  }

  getChildren() {
    if (this.isCategory()) {
      return getAllLocalGalleries(
        this.extensionUri,
        this.type === remoteCategoryType
      ).then((projects) =>
        projects.map(
          (prj) =>
            new GalleryTreeItem(
              this.extensionUri,
              vscode.TreeItemCollapsibleState.Collapsed,
              prj.config.project_name,
              prj.index.isExternal ? externalGalleryType : internalGalleryType,
              prj
            )
        )
      );
    } else {
      return this.getChapters();
    }
  }

  getChapters() {
    if (this.isGallery() && this.project) {
      return Object.keys(this.project.parameters).map(
        (name) =>
          new GalleryTreeItem(
            this.extensionUri,
            vscode.TreeItemCollapsibleState.Collapsed,
            name,
            chapterType,
            this.project
          )
      );
    } else if (this.type === chapterType && this.project) {
      return this.project.parameters[this.name].map((sect) => {
        const lastPart = sect.image_path.split("/");
        return new GalleryTreeItem(
          this.extensionUri,
          vscode.TreeItemCollapsibleState.None,
          lastPart[lastPart.length - 1].replace(".png", ""),
          sectionType,
          this.project
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
  private categoryNodes: GalleryTreeItem[];
  constructor(private extensionUri: vscode.Uri) {
    this.categoryNodes = [
      new GalleryTreeItem(
        this.extensionUri,
        vscode.TreeItemCollapsibleState.Expanded,
        "Remote Galleries",
        remoteCategoryType
      ),
      new GalleryTreeItem(
        this.extensionUri,
        vscode.TreeItemCollapsibleState.Expanded,
        "Local Galleries",
        localCategoryType
      ),
    ];
  }

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
      return Promise.resolve(element.getChildren());
    } else {
      return this.categoryNodes;
    }
  }
}

export class RecommendedGalleryTreeItem extends vscode.TreeItem {
  constructor(
    private readonly config: GalleryConfig
  ) {
    super(config.project_name, vscode.TreeItemCollapsibleState.None);
    this.description = `v${this.config.user_content_version}`;
    this.tooltip = this.config.repository_url;
    this.command = {
      title: "Plywood Gallery: Import a Gallery from GitHub.",
      command: "plywood-gallery.ImportRemote",
      arguments: [this.config.repository_url],
    };
    this.iconPath = this.config.favicon;
  }
}

export class RecommendedGalleriesProvider
  implements vscode.TreeDataProvider<RecommendedGalleryTreeItem>
{
  constructor(private extensionUri: vscode.Uri) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    RecommendedGalleryTreeItem | undefined | void
  > = new vscode.EventEmitter<RecommendedGalleryTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    RecommendedGalleryTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  getTreeItem(element: RecommendedGalleryTreeItem): vscode.TreeItem {
    return element;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(
    element?: RecommendedGalleryTreeItem
  ): Promise<RecommendedGalleryTreeItem[]> {
    if (element) {
      return [];
    } else {
      Log.info("Fetching enlisted recommended gallery URLS...");
      const enlisting = await getContent(
        RECOMMENDED_GALLERY_ENLISTING_CONFIG_URL
      );
      if (!enlisting) {
        Log.error("Enlisted gallery URLs unable to be fetched");
        return [];
      }
      Log.info("Gallery URLs Fetched");
      const enlisted: RecommendedGalleryTreeItem[] = [];
      JSON.parse(enlisting.data).forEach(async (url: string) => {
        const conf = await fetchRemoteConfig(this.extensionUri, url);
        if (!conf) {
          return;
        }
        enlisted.push(new RecommendedGalleryTreeItem(conf));
      });
      return enlisted;
    }
  }
}
