# GitHub source repository

## Source destination

The public source repository is [SeraKah-1/noodl-gpt](https://github.com/SeraKah-1/noodl-gpt). Its default branch is `main`.

The owner created this repository on 2026-11-16. It initially contained one README file. The source integration preserves its initial commit.

Public visibility applies to the source repository. It does not change the existing website or plugin audience.

The local checkout has a `github` remote and a separate `sites` remote. A GitHub push does not deploy the website or publish a plugin update. See [Deployment](DEPLOYMENT.md).

## Clone and inspect

```sh
git clone https://github.com/SeraKah-1/noodl-gpt.git
cd noodl-gpt
git status --short
```

Read `AGENTS.md`. Inspect the relevant code before you change it. Follow [Development](DEVELOPMENT.md) and [Contribution procedure](../CONTRIBUTING.md).

## Push a prepared change

1. Inspect the remote URL.
2. Fetch the current branch.
3. Review incoming commits and integrate them without removing existing work.
4. Run the checks required for the change.
5. Push the prepared branch.
6. Compare the local and remote commit IDs.

In the original prepared checkout, the GitHub remote is named `github`:

```sh
git remote get-url github
git fetch github main
git log --oneline --left-right HEAD...github/main
git push github HEAD:main
git ls-remote github refs/heads/main
```

A normal clone names this remote `origin`. Use the actual remote name. Do not force-push an existing branch. Do not remove the separate Sites remote.

## Transfer files

A source archive contains tracked files from its prepared commit. It excludes `.git`, dependencies, build outputs, and local environment files.

A Git bundle contains the prepared branch and its reachable history. It does not include local authentication configuration. Keep the source licenses.

To restore a prepared bundle on another machine:

```sh
git clone /path/to/noodl-chatgpt-workspace.bundle noodl-gpt
cd noodl-gpt
git remote rename origin archive
git remote add github https://github.com/SeraKah-1/noodl-gpt.git
git fetch github main
```

Use the actual bundle path. Compare histories before a push. Authenticate with the normal GitHub credential flow. Do not put a token in a chat or commit.
