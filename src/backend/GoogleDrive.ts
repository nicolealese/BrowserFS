import PreloadFile from '../generic/preload_file';
import {BaseFileSystem, FileSystem, BFSOneArgCallback, BFSCallback} from '../core/file_system';
import {File} from '../core/file';
import {FileFlag} from '../core/file_flag';
import {default as Stats, FileType} from '../core/node_fs_stats';
import {ApiError, ErrorCode} from '../core/api_error';
import * as path from 'path';
import {arrayBuffer2Buffer, buffer2ArrayBuffer} from '../core/util';

// const pathMatcher = /(.*)\/(.*)/;

// function dirname(path: string): string {
//   return path.match(pathMatcher)[1];
// }

// function basename(path: string): string {
//   // if (typeof path.match(pathMatcher)[0] !== null) {
//     return path.match(pathMatcher)![0];
//   // }
//   // else {
//   //   return "";
//   // }
// }

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

  public static authorize(clientId: string, cb: (fs: GoogleDriveFileSystem) => void): void {
    if (GoogleDriveFileSystem.isAvailable()) {
        let oauthToken: any;

        // Use the API Loader script to load google.picker and gapi.auth.
        const onApiLoad = () => {
            // load the APIs
            gapi.load('client:auth', onAuthApiLoad);
        };

        const onAuthApiLoad = () => {
            // Scope to use to access user's items.
            const scope = ['https://www.googleapis.com/auth/drive'];

            ( < any > window).gapi.auth.authorize({
                    client_id: clientId,
                    scope: scope,
                    immediate: false
                },
                // log the user in
                handleAuthResult);
        };

        const handleAuthResult = (authResult: any) => {
            if (authResult && !authResult.error) {
                oauthToken = authResult.access_token;
                gapi.client.load('drive', 'v2', () => {
                    const fs  = new GoogleDriveFileSystem(oauthToken);
                    fs.empty(() => {
                        cb(fs);
                    });
                });
            }
        };

        onApiLoad();
    } else {
        throw new Error("error");
    }
}
  private _oauthToken: any;
  private files: Map<string, GoogleDriveFile>;

  constructor(oauthToken: any) {
    super();
    this.files = new Map();
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

   public _writeFileStrict(p: string, data: ArrayBuffer, cb: BFSOneArgCallback): void {
    const parent = path.dirname(p);
    const title = path.basename(p);
    this.stat(parent, false, (error: ApiError, stat?: Stats): void => {
      if (error) {
        cb(ApiError.FileError(ErrorCode.ENOENT, parent));
      } else {
        this.writeFile(title, data, null, new FileFlag('w'), 0, cb);
        cb(null);
      }
    });
  }

  public writeFile(fname: string, data: any, encoding: string | null, flag: FileFlag, mode: number, cb: BFSOneArgCallback): void {
    this.stat(fname, null, (err, r) => {
      // what to do here ? (if err)
      if (err) {
        return cb(ApiError.ENOENT(fname));
      }
      if (typeof r !== 'undefined') {
        if (r.isDirectory()) {
          return cb(ApiError.EISDIR(fname));
        } else {
          const request = gapi.client.drive.files.list({
            q: "title = '" + fname + "'"
          });
          request.execute(function(resp) {
            if (typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
              const id = resp.items[0].id;
              const boundary = '-------314159265358979323846';
              const delimiter = "\r\n--" + boundary + "\r\n";
              const closeDelim = "\r\n--" + boundary + "--";

              const contentType = "text/html";
              const metadata = {
                mimeType: contentType,
              };

              const multipartRequestBody =
              delimiter + 'Content-Type: application/json\r\n\r\n' +
              JSON.stringify(metadata) +
              delimiter + 'Content-Type: ' + contentType + '\r\n' + '\r\n' +
              data +
              closeDelim;

              const callback = function(file: any) {
                cb(null);
              };

              (<any> (gapi.client.request))({
                path: '/upload/drive/v3/files/' + id + "&uploadType=multipart",
                method: 'PATCH',
                params: {
                    fileId: id,
                    uploadType: 'multipart'
                },
                headers: {
                    'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                },
                body: multipartRequestBody,
                callback: callback,
              });
            } else {
              cb(ApiError.ENOENT(fname));
            }
          });
        }
      }
    });
  }

  /**
   * Get the names of the files in a directory
   */
  public readdir(p: string, cb: BFSCallback<string[]>): void {
    this.stat(p, null, function(err, r) {
      // what to do here ? (if err)
      if (err) {
        return cb(ApiError.ENOENT(p));
      }
      if (typeof r !== 'undefined') {
         if (r.isFile()) {
          return cb(ApiError.ENOTDIR(p));
        } else {
          const title = path.basename(p);
          let i = 0;
          let nameArray: any[];
          nameArray = [];

          const request = gapi.client.drive.files.list({
            q: "title = '" + title + "'"
          });

          request.execute(function(resp) {
            const listCb = function(resp3: any) {
              const getCb = function(resp2: any) {
                nameArray.push(resp2.title);
                i++;
                if (i < resp3.items.length) {
                    const secondRequest = gapi.client.drive.files.get({
                      fileId: resp3.items[i].id
                    });
                    secondRequest.execute(getCb);
                  } else {
                    return cb(null, nameArray);
                  }

              };
              const initialGetRequest = gapi.client.drive.files.get({
                fileId: resp3.items[i].id
              });
              initialGetRequest.execute(getCb);

            };

            const id = resp.items[0].id;
            const retrievePageOfChildren = function(request: any, result: any) {
              request.execute(listCb);
            };

            const initialRequest = (<any> (gapi.client.drive)).children.list({
              folderId : id
            });
            retrievePageOfChildren(initialRequest, []);
          });
        }
      }
    });
  }

  /**
   * Private
   * Delete a file or directory from Google Drive
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
        if (typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
            const id = resp.items[0].id;
            const secondRequest = gapi.client.drive.files.get({
                fileId: id
            });
            secondRequest.execute((resp) => {
                const type = resp.mimeType;
                if (type === 'application/vnd.google-apps.folder') {
                    this._remove(p, cb);
                } else {
                  cb(ApiError.ENOTDIR(p));
                }
            });
        } else {
          cb(ApiError.ENOENT(p));
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
        if (typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
            const id = resp.items[0].id;
            const secondRequest = gapi.client.drive.files.get({
                fileId: id
            });
            secondRequest.execute((resp) => {
                const type = resp.mimeType;
                if (type === 'application/vnd.google-apps.folder') {
                  cb(ApiError.EISDIR(p));
                } else {
                  this._remove(p, cb);
                }
            });
        } else {
          cb(ApiError.ENOENT(p));
        }
    });
  }

  public createFile(p: string, flag: FileFlag, mode: number, cb: BFSCallback<File>): void {
    const title = path.basename(p);
    const dir = path.dirname(p);
    const base = path.basename(dir);

    const request = gapi.client.drive.files.list({
        q: "title = '" + base + "'"
    });
    request.execute((resp) => {
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
                mimeType: "text/html",
            }
        });
        secondRequest.execute((resp) => {
          const buffer = arrayBuffer2Buffer(new ArrayBuffer(0));
          const stats = new Stats(FileType.FILE, buffer.length, 0);
          const file = new GoogleDriveFile(this, title, flag, stats, buffer);
          cb(null, file);
        });
      } else {
        cb(ApiError.ENOENT(p));
      }
    });
  }

  public rename(oldPath: string, newPath: string, cb: BFSOneArgCallback): void {
    const oldTitle = path.basename(oldPath);
    const newTitle = path.basename(newPath);
    const newDir = path.dirname(newPath);
    const newBase = path.basename(newDir);

    const request = gapi.client.drive.files.list({
        q: "title = '" + oldTitle + "'"
    });
    request.execute(function(resp) {
        const fileId = resp.items[0].id;

        const secondRequest = gapi.client.drive.files.list({
            q: "title = '" + newBase + "'"
        });
        secondRequest.execute(function(resp) {
            const folderId = resp.items[0].id;
            const body = {id: folderId};
            const thirdRequest = (<any> (gapi.client.drive)).parents.insert({
                fileId: fileId,
                resource: body
            });
            thirdRequest.execute(function(resp: any) {
                cb(null);
             });
            const secondBody = {title: newTitle};
            const fourthRequest = (<any> (gapi.client.drive.files)).patch({
                fileId: fileId,
                resource: secondBody
            });
            fourthRequest.execute(function(resp: any) {
                cb(null);
            });
        });
    });
  }

  /**
   * Opens the file at path p with the given flag. The file must exist.
   * @param p The path to open.
   * @param flag The flag to use when opening the file.
   */
  public openFile(p: string, flag: FileFlag, cb: BFSCallback<File>): void {
    this.stat(p, null, (err, r) => {
      // what to do here ? (if err)
      if (err) {
        return cb(ApiError.ENOENT(p));
      }
      if (typeof r !== 'undefined') {
         if (r.isDirectory()) {
          return cb(ApiError.EISDIR(p));
        } else {
          const title = path.basename(p);
          const request = gapi.client.drive.files.list({
              q: "title = '" + title + "'"
          });
          request.execute((resp) => {
            if (typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
              const id = resp.items[0].id;
              // make the request to the google drive server
              gapi.client.request({
                  path: '/drive/v2/files/' + id,
                  method: 'GET'
              }).execute((obj) => {
                      const xhr = new XMLHttpRequest();
                      xhr.open("GET", obj.downloadUrl);
                      xhr.setRequestHeader("Authorization", "Bearer " + gapi.auth.getToken().access_token);
                      xhr.onload = () => {
                          const data = xhr.response;
                          const buffer = arrayBuffer2Buffer(data);
                          const stats = new Stats(FileType.FILE, buffer.length, 0);
                          const file = new GoogleDriveFile(this, title, flag, stats, buffer);
                          this.files.set(title, file);
                          cb(null, file);
                      };
                      xhr.send();
                  });
                } else {
                  // throw new Error("that path does not exist");
                  cb(ApiError.ENOENT(p));
                }
              });
            }
          }
        });
      }

  public readFile(fname: string, encoding: string | null, flag: FileFlag, cb: BFSCallback<string | Buffer>): void {
    this.stat(fname, null, (err, r) => {
      // what to do here ? (if err)
      if (err) {
        return cb(ApiError.ENOENT(fname));
      }
      if (typeof r !== 'undefined') {
        if (r.isDirectory()) {
          return cb(ApiError.EISDIR(fname));
        } else {
          const gdriveFile = this.files.get(fname);
          if (gdriveFile !== undefined) {
            cb(null, gdriveFile.getBuffer());
          } else {
            // throw new Error('gdriveFile is undefined');
            cb(ApiError.ENOENT(fname));
          }
        }
      }
    });
  }
}

export class GoogleDriveFile extends PreloadFile<GoogleDriveFileSystem> implements File {
  constructor(_fs: GoogleDriveFileSystem, _path: string, _flag: FileFlag, _stat: Stats, contents?: Buffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  // public sync(cb: BFSOneArgCallback): void {
  //   cb();
  // }

   public sync(cb: BFSOneArgCallback): void {
    if (this.isDirty()) {
      const buffer = this.getBuffer(),
        arrayBuffer = buffer2ArrayBuffer(buffer);
      this._fs._writeFileStrict(this.getPath(), arrayBuffer, (e?: ApiError) => {
        if (!e) {
          this.resetDirty();
        }
        cb(e);
      });
    } else {
      cb();
    }
  }

  public close(cb: BFSOneArgCallback): void {
    this.sync(cb);
  }
}
