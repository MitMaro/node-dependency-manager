#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE[0]}")" && source "./common.bash"

ensure-directory "docs/"

typedoc \
	--name "Node Dependency Manager" \
	--module "commonjs" \
	--ignoreCompilerErrors \
	--mode file \
	--target "ES6" \
	--theme minimal \
	--excludeExternals \
	--excludePrivate \
	--listInvalidSymbolLinks \
	--exclude "test/**/*.ts" \
	--out "docs/" \
	src/
