import {default as Stats, FileType} from '../core/node_fs_stats';

/**
 * Generic inode definition that can easily be serialized.
 */
export default class Inode {
  /**
   * Converts the buffer into an Inode.
   */
  public static fromBuffer(buffer: NodeBuffer): Inode {
    if (buffer === undefined) {
      throw new Error("NO");
    }
    return new Inode(buffer.toString('ascii', 38),
      buffer.readUInt32LE(0),
      buffer.readUInt32LE(4),
      buffer.readUInt32LE(8),
      buffer.readUInt16LE(12),
      buffer.readDoubleLE(14),
      buffer.readDoubleLE(22),
      buffer.readDoubleLE(30)
    );
  }

  constructor(public id: string,
              public dev: number,
              public ino: number,
              public size: number,
              public mode: number,
              public atime: number,
              public mtime: number,
              public ctime: number) { }

  /**
   * Handy function that converts the Inode to a Node Stats object.
   */
  public toStats(): Stats {
    const stats = new Stats(
      (this.mode & 0xF000) === FileType.DIRECTORY ? FileType.DIRECTORY : FileType.FILE,
      this.size, this.mode, new Date(this.atime), new Date(this.mtime), new Date(this.ctime));
    stats.dev = this.dev;
    stats.ino = this.ino;
    return stats;
  }

  /**
   * Get the size of this Inode, in bytes.
   */
  public getSize(): number {
    // ASSUMPTION: ID is ASCII (1 byte per char).
    return 38 + this.id.length;
  }

  /**
   * Writes the inode into the start of the buffer.
   */
  public toBuffer(buff: NodeBuffer = new Buffer(this.getSize())): NodeBuffer {
    buff.writeUInt32LE(this.dev, 0);
    buff.writeUInt32LE(this.ino, 4);
    buff.writeUInt32LE(this.size, 8);
    buff.writeUInt16LE(this.mode, 12);
    buff.writeDoubleLE(this.atime, 14);
    buff.writeDoubleLE(this.mtime, 22);
    buff.writeDoubleLE(this.ctime, 30);
    buff.write(this.id, 38, this.id.length, 'ascii');
    return buff;
  }

  /**
   * Updates the Inode using information from the stats object. Used by file
   * systems at sync time, e.g.:
   * - Program opens file and gets a File object.
   * - Program mutates file. File object is responsible for maintaining
   *   metadata changes locally -- typically in a Stats object.
   * - Program closes file. File object's metadata changes are synced with the
   *   file system.
   * @return True if any changes have occurred.
   */
  public update(stats: Stats): boolean {
    let hasChanged = false;
    if (this.size !== stats.size) {
      this.size = stats.size;
      hasChanged = true;
    }

    if (this.mode !== stats.mode) {
      this.mode = stats.mode;
      hasChanged = true;
    }

    const atimeMs = stats.atime.getTime();
    if (this.atime !== atimeMs) {
      this.atime = atimeMs;
      hasChanged = true;
    }

    const mtimeMs = stats.mtime.getTime();
    if (this.mtime !== mtimeMs) {
      this.mtime = mtimeMs;
      hasChanged = true;
    }

    const ctimeMs = stats.ctime.getTime();
    if (this.ctime !== ctimeMs) {
      this.ctime = ctimeMs;
      hasChanged = true;
    }

    return hasChanged;
  }

  // XXX: Copied from Stats. Should reconcile these two into something more
  //      compact.

  /**
   * @return [Boolean] True if this item is a file.
   */
  public isFile(): boolean {
    return (this.mode & 0xF000) === FileType.FILE;
  }

  /**
   * @return [Boolean] True if this item is a directory.
   */
  public isDirectory(): boolean {
    return (this.mode & 0xF000) === FileType.DIRECTORY;
  }
}
