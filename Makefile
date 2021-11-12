.PHONY: dist-linux dist-win dist-mac dist

dist: dist-linux dist-win dist-mac

dist-linux:
	npx electron-builder --linux

dist-win:
	npx electron-builder --win

dist-mac:
	npx electron-builder --mac
