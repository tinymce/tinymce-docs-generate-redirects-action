# TinyMCE Docs Generate Redirects Action

This action creates s3 objects to represent redirects that can be understood by
a customized envoy proxy.

## Inputs


### `build`

**Required** The path to the build directory where the docs site was constructed.

### `redirects`

**Required** The path to the redirects JSON file.

### `bucket`

**Required** The bucket to create the redirects in.


### `prefix`

**Required** The prefix in the bucket to create the redirects in.

### `parallel`

The number of redirect objects to create in parallel which can improve throughput. Default: 5

## Outputs


## Example usage

```yaml
uses: tinymce/tinymce-docs-generate-redirects-action@v1.0
with:
  build: ./build/
  redirects: ./redirects.json
  bucket: tiny-cloud-antora-docs-preview
  prefix: ${{env.PR}}/${{env.RUN}}
  parallel: 10
```

## Development

Open in devcontainer which has 2 containers:
- node
- minio

The node container is the main one and has environement variables setup to connect
AWS tools to the minio container.

The node container also has the AWS CLI installed.

### Test
```
yarn test
```

### Build
```
yarn build
```

### Release

0. Run `yarn tsc`, `yarn eslint` and `yarn test` to check the build.
1. Bump `package.json` version.
2. Build outputs with `yarn build` and commit.
3. Tag commit with `git tag -a v1.0 -m "Release 1.0"`
4. Push commit with tag `git push --follow-tags`