import {BaseFileSystem, FileSystem, BFSOneArgCallback, BFSCallback} from '../core/file_system';
import {default as Stats, FileType} from '../core/node_fs_stats';
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

  public empty(mainCb: BFSOneArgCallback): void {
    mainCb();
  }

  public stat(p: string, isLstat: boolean, cb: BFSCallback<Stats>): void {
    // Ignore lstat case -- GoogleDrive doesn't support symlinks
    // Stat the file

    //     const title = path.basename(p);
    //     // const stats;
    //     // const dir = path.dirname(p);
    //     // const base = path.basename(dir);

    //     const request = this._client.drive.files.list({
    //         q: "title = '" + title + "'"
    //     });
    //     request.execute((resp: any) => {
    //       if(typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined'){
    //         const id = resp.items[0].id;

    //           const secondRequest = this._client.drive.files.get({
    //     fileId: id
    //   });
    //   secondRequest.execute(function(resp: any) {
    //     console.log('Title: ' + resp.title);
    //     console.log('Description: ' + resp.description);
    //     console.log('MIME type: ' + resp.mimeType);

    //     const type = resp.mimeType;

    //     if (type === 'application/vnd.google-apps.folder') {
    //       const stats = new Stats(FileType.DIRECTORY, 0, 0);
    //       return cb(null, stats);
    //     } else {
    //       const stats = new Stats(FileType.FILE, 0, 0);
    //       return cb(null, stats);
    //     }
    //   });
    // } else {
    //   console.log("not a valid path");
    //   // const stats = new Stats(FileType.FILE, 0, 0);
    //   // return cb(null, stats);
    // }
    //       });
    //     // my code here
    //     return cb(null, null);

    const stats = new Stats(FileType.DIRECTORY, 0, 0);
    return cb(null, stats);
  }

  public _writeFileStrict(p: string, data: ArrayBuffer, cb: BFSCallback<Dropbox.File.Stat>): void {
    const title = path.basename(p);
    // const dir = path.dirname(p);
    // const base = path.basename(dir);

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
          //                console.log("Update Complete ", file);
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
    // Dropbox.js' client.mkdir() behaves like `mkdir -p`, i.e. it creates a
    // directory and all its ancestors if they don't exist.
    // Node's fs.mkdir() behaves like `mkdir`, i.e. it throws an error if an attempt
    // is made to create a directory without a parent.
    // To handle this inconsistency, a check for the existence of `path`'s parent
    // must be performed before it is created, and an error thrown if it does
    // not exist
    // const title = path.basename(p);
    //   const dir = path.dirname(p);
    //   const base = path.basename(dir);

    //   const request = this._client.drive.files.list({
    //       'q': 'title = '' + base + '''
    //   });
    //   request.execute((resp: any) => {
    //       const id = resp.items[0].id;
    //       console.log('id in callback = ' + id)

    //       const accessToken = this._oauthToken;
    //       const secondRequest = this._client.request({
    //           'path': '/drive/v2/files/',
    //           'method': 'POST',
    //           'headers': {
    //               'Content-Type': 'application/json',
    //               'Authorization': 'Bearer ' + accessToken,
    //           },
    //           'body': {
    //               'title': title,
    //               'parents': [{
    //                   'id': id
    //               }],
    //               'mimeType': 'application/vnd.google-apps.folder',
    //           }
    //       });

    //       secondRequest.execute(function(resp: any) {
    //           console.log('nested folder done creating')
    //            // cb(null);
    //       })
    //   });
    //   cb(null);
    // }

    const title = path.basename(p);
    const dir = path.dirname(p);
    const base = path.basename(dir);

    const request = this._client.drive.files.list({
      q: "title = '" + base + "'"
    });
    request.execute((resp: any) => {
      if (typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined') {
        const id = resp.items[0].id;
        //        console.log('id in callback = ' + id);

        //        console.log('defined');
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
          //          console.log('nested folder done creating');
        });

      } else {
        //        console.log('undefined');
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
          //          console.log('folder done creating');
        });

      }

    });
    cb(null);
  }

}
