# Source transfer to GitHub

## Current state

The intended destination is `SeraKah-1/noodl-chatgpt-workspace`. The user explicitly requested public visibility. This applies to the GitHub source repository. It does not change the existing website or plugin audience.

On 2026-11-16, the connected GitHub account was `SeraKah-1`. Public repository creation was retried through both GraphQL and REST. Both requests failed. GitHub returned `Resource not accessible by integration`; the REST status was 403.

The repository was not created. No source push to GitHub succeeded. Do not report the planned URL as an existing repository.

The local checkout retains the existing `sites` remote. This remote is separate from GitHub. Creating a GitHub repository does not deploy the website or publish a plugin update.

## Complete the transfer

1. Open <https://github.com/new> as the intended owner.
2. Set the name to `noodl-chatgpt-workspace`.
3. Select public visibility, as requested by the owner.
4. Leave the repository empty. Do not initialize a README, license, or ignore file.
5. Confirm that the connected integration has access to this new repository.
6. From the prepared checkout, add the GitHub remote.

```sh
git remote add github https://github.com/SeraKah-1/noodl-chatgpt-workspace.git
git push -u github HEAD:main
```

If a `github` remote already exists, inspect its URL before you change it. Do not force-push an existing repository. Do not remove the `sites` remote.

After the push, verify the repository URL, public visibility, branch, and commit ID. Update the source status in `README.md` and this document.

## Transfer files

The source archive contains tracked files from the prepared commit. It excludes `.git`, dependencies, build outputs, and local environment files.

The Git bundle contains the prepared branch and its reachable Git history. It does not contain authentication configuration or remote credentials. Keep the original source licenses.

To restore the Git bundle on another machine:

```sh
git clone /path/to/noodl-chatgpt-workspace.bundle noodl-chatgpt-workspace
cd noodl-chatgpt-workspace
git remote rename origin archive
git remote add github https://github.com/SeraKah-1/noodl-chatgpt-workspace.git
git push -u github HEAD:main
```

Use the actual bundle path. Authenticate with the normal GitHub credential flow. Do not paste a token into a chat or commit it.
