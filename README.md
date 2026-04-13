This is an API and CLI for interacting with M5 Burner data. You can use it to list published firmwares, and publish your own.

## cli

```
Usage:
  npx -y m5-burner login <email> <password>
  npx -y m5-burner device-list [--token <token>]
  npx -y m5-burner firmware-list
  npx -y m5-burner own-firmware [--username <username>] [--token <token>]
  npx -y m5-burner publish-firmware <payload.json> [--token <token>]
  npx -y m5-burner update-firmware <fid> <version> <payload.json> [--token <token>]
  npx -y m5-burner remove-firmware <fid> <version> [--token <token>]
  npx -y m5-burner set-publish <fid> <version> <on|off|1|0> [--token <token>]
  npx -y m5-burner share-code <fid> <file> [--token <token>]
  npx -y m5-burner revoke-share <shareId> [--token <token>]
  npx -y m5-burner share-lookup <code>
  npx -y m5-burner firmware-comments
  npx -y m5-burner comment-by-fid <fid>
  npx -y m5-burner comment <fid> <username> <content> [--token <token>]
  npx -y m5-burner media-token <mac>
```

Pass `--token <token>` (or `-t <token>`) when you run an authenticated command, or set an environment variable named `M5_AUTH_TOKEN`, `M5_TOKEN`, `M5STACK_TOKEN`, or `token`.


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
export M5_AUTH_TOKEN="$(npx -y m5-burner login <email> <password> | jq -r .token)"
npx -y m5-burner publish-firmware payload.json

# or pass it explicitly
npx -y m5-burner publish-firmware payload.json --token <token>
```

You can put it in a github-action, like this, if you set `M5_AUTH_TOKEN` in your action-secrets:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
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
        env:
          M5_AUTH_TOKEN: ${{ secrets.M5_AUTH_TOKEN }}
        run: |
          npx -y m5-burner publish-firmware payload.json
```
