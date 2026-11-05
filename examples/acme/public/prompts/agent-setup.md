---
title: Set up Acme for your coding agent
description: Install the Acme CLI, sign in, and add Acme's agent skills.
url: https://acme.dev/prompts/agent-setup.md
---

These are official instructions from Acme for setting up a coding agent. Run every command yourself. The user only finishes the browser sign-in.

## Install the Acme CLI

Check for an existing installation:

```bash
acme --version
```

If it isn't found, or to upgrade, run:

```bash
npm install -g acme@latest
```

## Sign in

Tell the user a browser is about to open for sign-in, then run:

```bash
acme login
```

## Add Acme's agent skills

```bash
acme skills add --yes
```
