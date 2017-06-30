/// <reference types='gapi.drive' />
import {BaseFileSystem, FileSystem, BFSOneArgCallback, BFSCallback} from '../core/file_system';
import {FileFlag} from '../core/file_flag';
import {default as Stats, FileType} from '../core/node_fs_stats';
import {ApiError} from '../core/api_error';
import * as path from 'path';

/**
 * A read/write file system backed by Google Drive cloud storage.
 *
 * Uses the Google REST API.
 *
 */
export default class GoogleDriveFileSystem extends BaseFileSystem implements FileSystem {
  public static isAvailable(): boolean {
    return true;
  }

  private _oauthToken: any;

  constructor(oauthToken: any) {
    super();
    this._oauthToken = oauthToken;
  }

  public getName(): string {
    return 'Google Drive';
  }

  public isReadOnly(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    return false;
  }

  public supportsSymlinks(): boolean {
    return false;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public empty(mainCb: BFSOneArgCallback): void {
    mainCb();
  }

  public stat(p: string, isLstat: boolean | null, cb: BFSCallback<Stats>): void {
    // Ignore lstat case -- GoogleDrive doesn't support symlinks
    // Stat the file
    if (p === '/') {
      // assume the root directory exists
      const stats = new Stats(FileType.DIRECTORY, 0, 0);
      return cb(null, stats);
    } else {
      const title = path.basename(p);
      const request = gapi.client.drive.files.list({
        q: "title = '" + title + "'",
      });
      request.execute((resp: any) => {
        if (typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
          const id = resp.items[0].id;
          const secondRequest = gapi.client.drive.files.get({
            fileId: id
          });
          secondRequest.execute(function(resp: any) {
            const type = resp.mimeType;
            if (type === 'application/vnd.google-apps.folder') {
              const stats = new Stats(FileType.DIRECTORY, 0, 0);
              return cb(null, stats);
            } else {
              const stats = new Stats(FileType.FILE, 0, 0);
              return cb(null, stats);
            }
          });
        } else {
          return cb(ApiError.ENOENT(p));
        }
      });
    }
  }

  /**
   * Create a directory
   */
  public mkdir(p: string, mode: number, cb: BFSOneArgCallback): void {
    const title = path.basename(p);
    const dir = path.dirname(p);
    const base = path.basename(dir);

    if (base === '.' || base === '/' || base === '') {
      const accessToken = this._oauthToken;
      const secondRequest = gapi.client.request({
        path: '/drive/v2/files/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
        },
        body: {
          title: title,
          mimeType: 'application/vnd.google-apps.folder',
        }
      });
      secondRequest.execute(function(resp: any) {
        cb(null);
      });
    } else {
      const request = gapi.client.drive.files.list({
        q: "title = '" + base + "'"
      });

      request.execute((resp: any) => {
        if (typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
          const id = resp.items[0].id;
          const accessToken = this._oauthToken;
          const secondRequest = gapi.client.request({
            path: '/drive/v2/files/',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + accessToken,
            },
            body: {
              title: title,
              parents: [{
                id: id
              }],
              mimeType: 'application/vnd.google-apps.folder',
            }
          });

          secondRequest.execute(function(resp: any) {
            cb(null);
          });
        } else {
          return cb(ApiError.ENOENT(dir));
        }
      });
    }
  }

  /**
   * Get the names of the files in a directory
   */
  public readdir(p: string, cb: BFSCallback<string[]>): void {
    const title = path.basename(p);
    let i = 0;
    let nameArray: any[];
    nameArray = [];

    const request = gapi.client.drive.files.list({
      q: "title = '" + title + "'"
    });

    request.execute(function(resp) {
      const id = resp.items[0].id;
      const retrievePageOfChildren = function(request: any, result: any) {
        request.execute(newCb);
      };
      const initialRequest = (<any> (gapi.client.drive)).children.list({
        folderId : id
      });
      retrievePageOfChildren(initialRequest, []);

      const newCb = function(resp2: any) {
        nameArray.push(resp2.title);
        i++;
        if (i < resp.items.length) {
          const secondRequest = gapi.client.drive.files.get({
            fileId: resp.items[i].id
          });
          secondRequest.execute(newCb);
        } else {
          return cb(null, nameArray);
        }
      };
    });
  }

  /**
   * Private
   * Delete a file or directory from Dropbox
   * isFile should reflect which call was made to remove the it (`unlink` or
   * `rmdir`). If this doesn't match what's actually at `path`, an error will be
   * returned
   */
  public _remove(p: string, cb: BFSOneArgCallback): void {
    const title = path.basename(p);

    const request = gapi.client.drive.files.list({
        q: "title = '" + title + "'"
    });
    request.execute(function(resp) {
        const id = resp.items[0].id;

        const secondRequest = gapi.client.drive.files.trash({
            fileId: id
        });
        secondRequest.execute(function(resp) {
          cb(null);
        });
    });
  }

  /**
   * Delete a directory
   */
  public rmdir(p: string, cb: BFSOneArgCallback): void {
    const title = path.basename(p);

    const request = gapi.client.drive.files.list({
        q: "title = '" + title + "'"
    });
    request.execute((resp) => {
        if (typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
            const id = resp.items[0].id;
            const secondRequest = gapi.client.drive.files.get({
                fileId: id
            });
            secondRequest.execute((resp) => {
                const type = resp.mimeType;
                if (type === 'application/vnd.google-apps.folder') {
                    this._remove(p, cb);
                } else {
                  throw new Error ("Error: it is a file !");
                }
            });
        } else {
          throw new Error ("That path does not exist");
        }
    });
  }

  /**
   * Delete a file
   */
  public unlink(p: string, cb: BFSOneArgCallback): void {
    const title = path.basename(p);

    const request = gapi.client.drive.files.list({
        q: "title = '" + title + "'"
    });
    request.execute((resp) => {
        if (typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
            const id = resp.items[0].id;
            const secondRequest = gapi.client.drive.files.get({
                fileId: id
            });
            secondRequest.execute((resp) => {
                const type = resp.mimeType;
                if (type === 'application/vnd.google-apps.folder') {
                  throw new Error ("Error: it is a file !");
                } else {
                  this._remove(p, cb);
                }
            });
        } else {
          throw new Error ("That path does not exist");
        }
    });

  }

  public readFile(fname: string, encoding: string | null, flag: FileFlag, cb: BFSCallback<string | Buffer>): void {
    throw new Error('in the read file');
  }
}
