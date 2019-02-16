# jsfarm

Sandboxed JS script execution service for safely executing untrusted JS code to do something useful!

### Security

None yet haha! But the plan is to use nsjail to seccomp an inner process to all hell and communicate with the outer world via json serialized messages to a host process.
