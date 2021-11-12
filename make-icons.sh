#!/usr/bin/env bash

mkdir -p assets/icons

inkscape -w 16 -h 16 -e assets/icons/logo16.png assets/logo.svg
inkscape -w 20 -h 20 -e assets/icons/logo20.png assets/logo.svg
inkscape -w 24 -h 24 -e assets/icons/logo24.png assets/logo.svg
inkscape -w 32 -h 32 -e assets/icons/logo32.png assets/logo.svg
inkscape -w 40 -h 40 -e assets/icons/logo40.png assets/logo.svg
inkscape -w 48 -h 48 -e assets/icons/logo48.png assets/logo.svg
inkscape -w 64 -h 64 -e assets/icons/logo64.png assets/logo.svg
inkscape -w 256 -h 256 -e assets/icons/logo256.png assets/logo.svg

convert assets/icons/logo{16,20,24,32,40,48,64,256}.png assets/icons/logo.ico
png2icns assets/icons/logo.icns assets/icons/logo{16,32,48,256}.png
