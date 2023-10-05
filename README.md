# cs-unpak

Efficiently unpack files from CS2 VPKs  
Fork of [node-csgo-cdn](https://github.com/Step7750/node-csgo-cdn)

## Table of Contents
  * [Why?](#why)
  * [How to Install](#how-to-install)
  * [Methods](#methods)
    * [Constructor(client, options)](#constructorclient-options)
    * [getFile(path)](#getfilepath)
  * [Events](#events)
    * [ready](#ready)

## Why

Starting with CS2, Valve has started storing the `items_game.txt` and `items_game_cdn.txt` files in the VPKs, and many websites use these files for skin related information  
Thus, the goal of this library is to create an easy way to efficiently (by only downloading the necessary vpk files) unpack specific files from the CS2 VPKs to make the tracking of those specific files easier (but it can work with any file you might want to extract)


## How to Install

`yarn add github:huggablesquare/cs-unpak`

See `example.js` for an example of how to use the library

## Methods

### Constructor(client, options)

* `client` - [node-steam-user](https://github.com/DoctorMcKay/node-steam-user) Client **The account MUST own CS2**
* `options` - Options
    ```javascript
    {
        directory: 'data', // relative data directory for VPK files
        logLevel: 'info', // logging level, (error, warn, info, verbose, debug, silly)
        neededDirectories: ['scripts/items'] // array of directories to get from the pak files
    }
    ```

### getFile(path)

* `path` - The path of the file inside the pak

You can get a list of the files contained in the CS2 pak [here](https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir.txt)  
Returns a buffer of the file

## Events

### ready

Emitted when `cs-unpak` is ready, this must be emitted before using the object
