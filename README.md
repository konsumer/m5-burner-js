This is an API and CLI for interacting with M5 Burner data. You can use it to list published firmwares, and publish your own.

## cli

```
Usage:
  npx -y m5-burner login <email> <password>
  npx -y m5-burner device-list <token | env:M5_AUTH_TOKEN>
  npx -y m5-burner firmware-list
  npx -y m5-burner own-firmware <token | env:M5_AUTH_TOKEN> [username]
  npx -y m5-burner publish-firmware <token | env:M5_AUTH_TOKEN> <payload.json>
  npx -y m5-burner update-firmware <token | env:M5_AUTH_TOKEN> <fid> <version> <payload.json>
  npx -y m5-burner remove-firmware <token | env:M5_AUTH_TOKEN> <fid> <version>
  npx -y m5-burner set-publish <token | env:M5_AUTH_TOKEN> <fid> <version> <on|off|1|0>
  npx -y m5-burner share-code <token | env:M5_AUTH_TOKEN> <fid> <file>
  npx -y m5-burner revoke-share <token | env:M5_AUTH_TOKEN> <shareId>
  npx -y m5-burner share-lookup <code>
  npx -y m5-burner firmware-comments
  npx -y m5-burner comment-by-fid <fid>
  npx -y m5-burner comment <token | env:M5_AUTH_TOKEN> <fid> <username> <content>
  npx -y m5-burner media-token <mac>
```

Use `login` to get a token, and then set `M5_AUTH_TOKEN` environment-variable, and operations after that will be authenticated.


### publishing

Make a payload.json like this:

```json
 {
    "fields": {
      "name": "My Firmware",
      "description": "Awesome build",
      "category": "core",
      "author": "YourUser",
      "version": "1.0.0",
      "github": "https://github.com/you/project"
    },
    "files": {
      "firmware": "./firmware.bin",
      "cover": "./cover.png"
    }
}
```

Make an image `cover.png` and your `firmware.bin` next to the file.

```bash
# get your token
npx -y m5-burner login <email> <password>

# use your token to publish
npx -y m5-burner publish-firmware <token> payload.json
```

You can put it in a github-action, like this, if you set `M5_AUTH_TOKEN` in your action-secrets:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v6

      # do whater you do to build
      
      - uses: actions/cache@v4
        with:
          path: |
            ~/.cache/pip
            ~/.platformio/.cache
          key: ${{ runner.os }}-pio
      - uses: actions/setup-python@v6
        with:
          python-version: '3.11'
      - name: Install PlatformIO Core
        run: pip install --upgrade platformio
      - name: Build PlatformIO Project
        run: pio run

      - name: Publish firmware on M5 Burner
        run: |
          npx -y m5-burner publish-firmware payload.json
```
