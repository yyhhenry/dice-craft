import path from "path"

export class WorkspaceGuard {
  private workspacePath: string

  constructor(workspacePath: string) {
    this.workspacePath = path.resolve(workspacePath)
  }

  assertWithinWorkspace(filepath: string): void {
    const resolved = this.resolvePath(filepath)
    const relative = path.relative(this.workspacePath, resolved)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Access denied: ${filepath} is outside workspace`)
    }
  }

  resolvePath(filepath: string): string {
    if (path.isAbsolute(filepath)) return filepath
    return path.resolve(this.workspacePath, filepath)
  }

  /** Get the workspace root path for display */
  getWorkspacePath(): string {
    return this.workspacePath
  }
}
