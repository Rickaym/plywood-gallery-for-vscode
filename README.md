# Plywood Gallery For VSCode

<a href="https://marketplace.visualstudio.com/items?itemName=Rickaym.plywood-gallery"><img alt="Extension Homepage" src="https://img.shields.io/badge/vscode-install%20Here-brightgreen?logo=visualstudiocode&style=for-the-badge"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=Rickaym.plywood-gallery"><img alt="Extension Version" src="https://img.shields.io/visual-studio-marketplace/v/Rickaym.plywood-gallery?style=for-the-badge&logo=verizon&logoColor=white"></a>
<a href="https://discord.gg/UmnzdPgn6g"><img src="https://img.shields.io/badge/GET SUPPORT-DISCORD-orange?style=for-the-badge&logo=discord&logoColor=white&color=5865F2"></a>

A Visual Studio code extension with rich support for integrating the use of
[Plywood Gallery](https://github.com/kolibril13/plywood-gallery):
allowing the insertion of code snippets into the editor through images galleries.

## Index

1. [Key Features](#key-features)
1. [Introduction](#introduction)
1. [Importing Gallaries](#importing-galleries)
1. [Release Notes](#release-notes)

## Key Features

- Visualizing Code Snippets
- Text/dropdown support for Code Snippets
- Gain access to many community and official code snippet repositories

## Introduction

A Gallery is a list of **code** and **image** mappings using
the template specifed by the core gallery [Plywood Gallery](https://github.com/kolibril13/plywood-gallery/).
Individual developers can make a gallery of their own by following the template and
publish them to Github where users can download and import them.

Once a gallery is
[imported](#importing-galleries), a webview will be installed revealing a set of
images that the gallery provides. After placing the cursor down to the desired location,
you can press on the images to insert the code snippet tied to it.
<br><br><img src="https://raw.githubusercontent.com/Rickaym/Plywood-Gallery-For-VSCode/master/media/usage.gif" width="600"><br><br>

After the extension is fully installed, you will be introduced to this treeview on the activity bar.
<br><br><img src="https://raw.githubusercontent.com/Rickaym/Plywood-Gallery-For-VSCode/master/media/treeview.png" width="200"><br><br>
Here you can control and modify imported galleries.

#### Certain things you can do inside the treeview

- Import Local and Remote galleries
- Remove Local and Remote galleries
- Check for Remote gallery updates
- Opening a gallery (clicking on the gallery item)
- Unpacking code items of a gallery

## Importing Galleries

You can load galleries from two distinct locations:

- [Remote GitHub Repositories](#remote-galleries)
- [Local Repositories/Directories](#local-galleries)

### Remote Galleries

#### Recommended

By default the extension provides a curated list of recommended Galleries.
<br><br><img src="https://raw.githubusercontent.com/Rickaym/Plywood-Gallery-For-VSCode/master/media/treeview2.png" width="200"><br><br>
You click these Galleries to download them instantenously.

For Gallery Developers: if you would like to feature your own Gallery for recommendations, make sure that your gallery meets the given security criteria and create an issue for it!

#### Repositories

In order to load a remote github gallery, you can use the
command `plywood-gallery.ImportRemote` or via the button for `cloud-download` in
the treeview navigation bar.

This will prompt an input box where you'll have to provide the URL of the repository to be imported.
Keep note though that the extension by default looks for a gallery
under the `main` branch of any specified repositories, in cases where this may not be intended, you can specify
an optional branch parameter before the URL with a semi-colon.

E.g.

```apache
master;https://github.com/kolibril13/plywood-gallery-minimal-example
```

### Local Galleries

In order to load a local gallery, you can use the
command:

- `plywood-gallery.ImportLocal`
- via the button for `desktop-download`

This will launch a file explorer for any `.yaml` files. Select the `gallery_config.yaml` file for the local gallery that you want to import (it doesn't have to be named gallery_config) and simply press open.

Importing a gallery inside a batch simply changes the protocol from picking a central
`gallery_config.yaml` file to picking the specific config file for the
gallery.

## Release Notes

Pre-release!

### 0.0.1-0.0.2

Initial release of the Plywood Gallery Extension

## Credits

- [kolibril13](https://github.com/kolibril13) for building the [plywood gallery core library](https://github.com/kolibril13/plywood-gallery) and [the minimal example](https://github.com/kolibril13/plywood-gallery-minimal-example).
- <a href="https://www.flaticon.com/free-icons/picture" title="picture icons">Picture icons created by Pixel perfect - Flaticon</a>
- <a href="https://www.flaticon.com/free-icons/photo" title="photo icons">Photo icons created by Andrean Prabowo - Flaticon</a>
- <a href="https://www.flaticon.com/free-icons/wood" title="wood icons">Wood icons created by Freepik - Flaticon</a>
