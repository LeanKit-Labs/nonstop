## nonstop
Nonstop is a bootstrapper/service host that self-updates when new packages that match its configured parameters become available in the nonstop-index.

## Configuration
Nonstop can be used either as a library or as a command line interface.

As a command, you can configure it via a `bootstrap.json` file and environment variables.

> Note: environment variables take precendent over settings in the file.

### Bootstrap file
Defaults are shown here. The `index` property provides information necessary to contact the package index. The `package` property allows you to specify filtering information for the package. You shouldn't need to set the `architecture` or `platform` as those are detected for you.

```json
{
    "index": {
      "host": "localhost",
      "api": "/api",
      "frequency": 300000,
      "port": 4444,
      "ssl": false,
      "token": ""
    },
    "package": {
      "architecture": detected,
      "branch": "",
      "build": "",
      "owner": "",
      "platform": detected,
      "project": "",
      "releaseOnly": false,
      "version": "",
      "files": "./downloads"
    },
    "port": 9090
  }
```

### Environment Variables
| Group | Variable | Default |
|-------|-------------|---------|
| __Index__ | | |
| | INDEX_HOST | `"localhost"` |
| | INDEX_API | `"api"` |
| | INDEX_FREQUENCY | `300000` |
| | INDEX_PORT | `4444` |
| | INDEX_SSL | `false` |
| | INDEX_TOKEN | `""` |
| __Package__ | | |
| | PACKAGE_OWNER | `` |
| | PACKAGE_PROJECT | `` |
| | PACKAGE_BRANCH | `` |
| | PACKAGE_BUILD | `` |
| | PACKAGE_VERSION | `` |
| | PACKAGE__RELEASE_ONLY | `` |
| | PACKAGE_ARCHITECTURE | detected |
| | PACKAGE_PLATFORM | detected |
| | PACKAGE_FILES | `"./downloads"` |
| __Service__ | | |
| | PORT | `9090` |

## Boot file - boot.yaml|boot.json
nonstop expects a boot file to be contained in any package it downloads which will provide the instructions for how it should start the packaged application. The files can be written in either JSON or YAML syntax.

The boot file consists of two sections: the service boot command and an optional pre-boot command set. The boot command simply tells nonstop how to start the packaged service while the optional pre-boot command set gets fed to [drudgeon](https://github.com/LeanKit-Labs/drudgeon). Both the boot command and pre-boot commands are expressed using `drudgeon`'s command syntax since it has a flexible means of supporting command and command set variation across platforms.

> Note: these examples are super arbitrary and should not be used to infer how you would actually create steps for an actual thing.

__JSON__
```javascript
{
  "boot": "node ./src/index.js",
  "preboot": {
    "one": {
      "win32": "gulp check-windows",
      "*": "gulp check"
    },
    "two": "node prep"
  }
}
```

__YAML__
```yaml
boot: "node ./src/index.js",
preboot:
  one:
    win32: "gulp check-windows"
    *: "gulp check"
  two: "node prep"
```


