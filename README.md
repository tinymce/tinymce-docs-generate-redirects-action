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
uses: tinymce/tinymce-docs-generate-redirects-action@main
with:
  build: ./build/
  redirects: ./redirects.json
  bucket: tiny-cloud-antora-docs-preview
  prefix: ${PR}/${RUN}
  parallel: 10
```