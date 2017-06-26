import {BaseFileSystem, FileSystem, BFSOneArgCallback, BFSCallback} from '../core/file_system';
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

  private _client: any;
  private _oauthToken: any;

  constructor(client: any, oauthToken: any) {
    super();
    this._client = client;
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

  public stat(p: string, isLstat: boolean, cb: BFSCallback<Stats>): void {
    // Ignore lstat case -- GoogleDrive doesn't support symlinks
    // Stat the file
    if (p === '/') {
    // assume the root directory exists
    const stats = new Stats(FileType.DIRECTORY, 0, 0);
    return cb(null, stats);
  }
  else {
    const title = path.basename(p);
    const request = this._client.drive.files.list({
      q: "title = '" + title + "'"
    });
    request.execute((resp: any) => {
    //   if (typeof resp.items === 'undefined') {
    //   console.log("resp items is undefined");
    //   var b = true; 
    //   if (b) {
    //     throw new Error ('in the request body')
    //   }
    //   return cb(ApiError.ENOENT(p));
    // }
    if(typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined'){
      console.log("in the stat if block");
      const id = resp.items[0].id;
      const secondRequest = this._client.drive.files.get({
        fileId: id
      });
      secondRequest.execute(function(resp: any) {
        console.log('Title: ' + resp.title);
        console.log('Description: ' + resp.description);
        console.log('MIME type: ' + resp.mimeType);
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
      var b = true; 
      if (b) {
        throw new Error ('in the stat else block')
      } 
      return cb(ApiError.ENOENT(p));
    }
  });
  }
}

  public _writeFileStrict(p: string, data: ArrayBuffer, cb: BFSCallback<Dropbox.File.Stat>): void {
    const title = path.basename(p);

    const request = this._client.drive.files.list({
      q: "title = '" + title + "'"
    });
    request.execute((resp: any) => {
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

        if (!cb) {
        cb = function(file) {
        };
      }

      this._client.request({
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
        callback: cb,
      });
    });
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
      const secondRequest = this._client.request({
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
    }

    else {
      const request = this._client.drive.files.list({
        q: "title = '" + base + "'"
      });

      request.execute((resp: any) => {
      if (typeof resp.items !== 'undefined' && typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
        console.log("in the mkdir if block"); 
        const id = resp.items[0].id;
        const accessToken = this._oauthToken;
        const secondRequest = this._client.request({
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
        var b = true;
        if (b) {
          throw new Error ('in the mkdir else block')
        } 
        return cb(ApiError.ENOENT(dir));
      }
    });
    }
  }
}
