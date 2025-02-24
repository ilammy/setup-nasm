Maintainer Cheatsheet
=====================

## Making a new release

1. Make sure your tree is in sync with the mothership

    ```
    git fetch
    git checkout master && git pull
    git checkout release/v1 && git pull
    ```

2. Merge `master` into `release/v1`

    ```
    git merge master --no-commit
    vim package.json package-lock.json          # update "version"
    npm ci --omit=dev
    git add node_modules
    git commit -p -m "setup-nasm v1.X.X"
    ```

3. Tag and sign the release

    ```
    git tag --sign v1.X.X
    ```

    Tag comment looks like this:
    ```
    setup-nasm v1.5.0

    - Update default NASM to 2.16.01
    ```

4. Push the new tag and `release/v1` branch

    ```
    git push origin release/v1 v1.X.X
    ```

    Visit and check that it looks okay and CI passes:

    * https://github.com/ilammy/setup-nasm/tree/release/v1
    * https://github.com/ilammy/setup-nasm/tags

5. Draft the release notes

    Visit and prepare a draft

    * https://github.com/ilammy/setup-nasm/releases/new

    Release title and comment look like this

    ```markdown
    setup-nasm v1.5.0

    * Update package-lock.json (https://github.com/ilammy/setup-nasm/pull/39)
    * Update default nasm version (https://github.com/ilammy/setup-nasm/pull/38)

    New contributors:

    * @Brooooooklyn
    ```

    Click the `[Save draft]` button

    Check how it looks in https://github.com/ilammy/setup-nasm/releases

6. Publish the release

    Press the `[Publish release]` button

    Check how it looks in https://github.com/ilammy/setup-nasm/releases

7. Push the updated `v1` tag alias

    ```
    git tag --force v1 v1.X.X
    git push --force origin v1
    ```
