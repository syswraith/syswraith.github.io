---
title: Projects
description: Syswraith's projects, including emulators, interpreters, OSINT tools, games, and scrapers.
---

# Projects

## [CHIP-8](https://github.com/syswraith/chip8)
#### Emulator / Virtual machine • C
A CHIP-8 emulator using Raylib, with a full fetch-decode-execute cycle, custom opcode table, and display/keypad handling. Validated against ROMs like Breakout, Tetris, and Maze - extended with a nonstandard opcode that streams pre-processed 1-bit video into the display buffer for full-motion playback.

## [Jorth](https://github.com/syswraith/jorth)
#### Forth interpreter • JavaScript
A stack-based Forth interpreter written in JavaScript, compiled with QuickJS into a single native binary. Supports word definitions, loops, conditionals, variables, and raw keyboard input, with no runtime dependency. Check out <a href="https://syswraith.com/jorth/">https://syswraith.com/jorth/</a>.

## [Heimdall](https://github.com/syswraith/heimdall)
#### Username enumerator (OSINT) • Go
A single-binary tool that hunts down a username's footprint across the web- fast and concurrent by design. It checks presence via raw HTTP, JSON APIs, OpenGraph parsing, and headless/headed browser automation, skipping the need for hand-rolled parsing per site. Results are cached in SQLite, with configs fully YAML-driven for easy extension.

## [Decompyler](https://github.com/syswraith/decompyler)
#### PyInstaller decompiler/disassembler • Python
Extracts PyInstaller-packed EXE and ELF binaries, lists their embedded .pyc modules, and disassembles or decompiles them side by side with pycdas and pycdc. Includes syntax-highlighted source editing, stdlib module hiding, and configurable paths for the pycdc and pycdas binaries.

## [Scoundrel](https://github.com/syswraith/scoundrel)
#### Terminal roguelike card game • C++
A terminal implementation of Zach Gage &amp; Kurt Bieg's 2011 card game <em>Scoundrel</em>, built with FTXUI. Rooms of 4 cards are dealt from a standard 52-card deck—fight monsters (♠ ♣), equip weapons (♦) to reduce damage, and heal with potions (♥). Survive without reaching 0 HP; clear rooms until the deck runs out to win.

## [Gruvboxify](https://github.com/syswraith/gruvboxify)
#### Image converter • Python
Converts batches of PNG, JPEG, WebP, GIF, BMP, and TIFF images to the Gruvbox palette with drag-and-drop file selection and per-file conversion progress. Offers three palettes, EXIF orientation handling, transparency preservation, and NumPy-accelerated matching, with output saved to a persistent folder.

## [Ryukendo](https://github.com/syswraith/ryukendo)
#### Wordlist generator • Python
A wordlist generator that leverages social connections to produce candidate passwords. Uses cartesian products, permutations &amp; combinations and probability distributions to generate, sort and rank possible passwords.

## [Ngzl](https://github.com/syswraith/ngzl)
#### IRC C2 prototype • Python
A prototype botnet script using the IRC protocol as command-and-control. Implements a client–server model with custom sockets for receiving shell commands and relaying output through an IRC server.

## [Logo Interpreter](https://github.com/syswraith/logo)
#### Interpreter • TypeScript
A minimalistic Microsoft Logo interpreter featuring a custom tokenizer, recursive parser, AST generator, and an HTML5 Canvas drawing engine with angle-based turtle movement.

## [Wintermute](https://github.com/syswraith/wintermute)
#### URL shortener • TypeScript + Go
A service for creating and retrieving shortened URLs with authentication and expiration capabilities. Users can generate compact aliases for long URLs, retrieve the originals via lookup, and manage access through JWT-based authentication with configurable expiry policies.

## [Moodle Scraper](https://github.com/syswraith/moodle-scraper)
#### Web scraper • Python
A proof-of-concept data extraction tool for retrieving public profile details from a private Moodle instance. Handles login token authentication and stores the extracted data in a local SQLite database.

## [Drunken Bishop](https://github.com/syswraith/c-projects/)
#### Key visualizer • C
An implementation of the Drunken Bishop algorithm used by OpenSSH to generate ASCII art representations of cryptographic keys.

## [AML Shield](https://github.com/Tervicke/bytecamp-26)
#### Monitoring platform • JavaScript/TypeScript
A real-time transaction monitoring platform that uses network analysis and interactive dashboards to detect suspicious financial activity. Built for the 24-hour bytecamp-26 hackathon.

## [IdentityShield](https://github.com/syswraith/vortexa-26)
#### Auth risk assessment platform • TypeScript
A full-stack authentication and risk assessment platform that evaluates login behavior using browser fingerprints, IP geolocation, and Supabase-backed session tracking. Combines React frontend, Express backend, and database migrations for auth-risk workflows. Built for the vortexa-26 hackathon.

## [Orion](https://github.com/Tervicke/devcraft-orion)
#### Auction system • TypeScript + Go
A distributed auction system featuring Go backend services for concurrent bidding and state management, a TypeScript frontend for the reactive UI, and Python utilities for data processing pipelines. Built for the 48-hour devcraft '26 hackathon.

## [WhatsApp Chat Summariser](https://github.com/syswraith/wa-chat-summariser)
#### Chat summarisation pipeline • Node.js
A chat summary service that pulls messages, sends them to a local LLM, and returns notifications via a publish–subscribe system. Built using Axios, whatsapp-web.js, NTFY, Ollama, and Deepseek-r1:7b.

## [Hashing Implementations](https://github.com/syswraith/c-projects)
#### Data structures • C
Implementations of basic hashing concepts and collision resolution techniques, including chaining using linked lists, linear probing, and quadratic probing, in memory-safe C.

## [Bus Reservation System](https://github.com/syswraith/c-projects)
#### Terminal application • C
A terminal-based bus reservation system written in C, featuring interactive seat selection and formatted CLI layouts.

## [Dots and Boxes](https://github.com/syswraith/python-projects)
#### Terminal game • Python
A command-line implementation of the classic Dots and Boxes board game, focusing on custom grid and connection logic.

## [Tic Tac Toe](https://github.com/syswraith/c-projects)
#### Terminal game • C
A command-line Tic Tac Toe game written in C, featuring a board state managed using a flattened 2D array.
