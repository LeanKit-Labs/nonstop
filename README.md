## nonstop
Nonstop is a bootstrapper/service host that self-updates when new packages that match its configured parameters become available in the nonstop-index.

## Configuration
Nonstop can be used either as a library or as a command line interface. 

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

