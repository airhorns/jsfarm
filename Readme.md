# jsfarm

Sandboxed JS script execution service for safely executing untrusted JS code to do something useful!

### Developing

Run `yarn dev` to get a dev server that automatically compiles and reloads the source code from `src`.

### Security

None yet haha! But the plan is to use nsjail to seccomp an inner process to all hell and communicate with the outer world via json serialized messages to a host process.
