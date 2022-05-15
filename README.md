# Plywood Gallery For VSCode

<a href="https://marketplace.visualstudio.com/items?itemName=Rickaym.plywood-gallery"><img alt="Extension Homepage" src="https://img.shields.io/badge/vscode-install%20Here-brightgreen?logo=visualstudiocode&style=for-the-badge"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=Rickaym.plywood-gallery"><img alt="Extension Version" src="https://img.shields.io/visual-studio-marketplace/v/Rickaym.plywood-gallery?style=for-the-badge&logo=verizon&logoColor=white"></a>
<a href="https://discord.gg/UmnzdPgn6g"><img src="https://img.shields.io/badge/GET SUPPORT-DISCORD-orange?style=for-the-badge&logo=discord&logoColor=white&color=5865F2"></a>

A utility Extension to visualize code snippets for Graphical Frameworks.

## Key Features

- Visualizing Code Snippets
- Text/dropdown support for Code Snippets
- Gain access to many community and official code snippet repositories

A gallery simply put is a list of mappings of **code** and **image** using
the template specifed by the core gallery [Plywood Gallery](https://github.com/kolibril13/plywood-gallery/).
Community members can make a gallery of their own by following the said template and
publish them to Github where users can download and import them. Once a gallery is
imported via [these steps](#importing-galleries), a webview will be installed for the
imported gallery whereby using it is as easy as pressing on the images of the objects that
you want the code equivalent for.
<br><br><img src="https://raw.githubusercontent.com/Rickaym/Plywood-Gallery-For-VSCode/master/media/usage.gif" width="600"><br><br>


## Introduction

After the extension is fully installed, you will be introduced to this treeview on the activity bar.
<br><br><img src="https://raw.githubusercontent.com/Rickaym/Plywood-Gallery-For-VSCode/master/media/treeview.png" width="200"><br><br>
Here you can manage all functionality for the extension and control and modify
imported galleries.

#### Certain things you can do inside the treeview
- Import Local and Remote galleries
- Remove Local and Remote galleries
- Check for Remote gallery updates
- Opening a gallery (by clicking on the gallery item)
- Detailing code items of a gallery

## Importing Galleries

You can load galleries from two distinct locations:
- [Remote GitHub Repositories](#remote-galleries)
- [Local Repositories/Directories](#local-galleries)

### Remote Galleries
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
command `plywood-gallery.ImportLocal` or via the button for `desktop-download`
in the treeview navigation bar. This will bring up a file explorer that accepts any
`.yaml` files. You will successively have to find the `gallery_config.yaml` file
for the local gallery that you intend to import (it doesn't have to be named gallery_config) and simply press open.

Importing a gallery inside a batch simply changes the protocol from picking a central
`gallery_config.yaml` file to picking the specific config file for the
gallery.

## Known Issues

###### No Known Issues...

## Release Notes

Pre-release!

### 0.0.1

Initial release of Plywood Gallery

## Credits

- [kolibril13](https://github.com/kolibril13) for building the relevant [libraries](https://github.com/kolibril13/plywood-gallery) and [templates]().
- <a href="https://www.flaticon.com/free-icons/picture" title="picture icons">Picture icons created by Pixel perfect - Flaticon</a>
- <a href="https://www.flaticon.com/free-icons/photo" title="photo icons">Photo icons created by Andrean Prabowo - Flaticon</a>
- <a href="https://www.flaticon.com/free-icons/wood" title="wood icons">Wood icons created by Freepik - Flaticon</a>
