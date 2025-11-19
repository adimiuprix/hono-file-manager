    const fm = {
      currentPath: '',
      files: [],
      selected: new Set(),
      contextTarget: null,
      treeCache: {},
      expandedFolders: new Set(),
      sidebarVisible: true,

      async init() {
        await this.loadFiles();
        await this.loadTree();
        document.addEventListener('click', () => this.hideContextMenu());
        document.getElementById('fileInput').addEventListener('change', this.handleFileSelect.bind(this));
        
        // Restore sidebar state
        const stored = localStorage.getItem('sidebarVisible');
        if (stored === 'false') {
          this.toggleSidebar();
        }

        // Setup drag and drop
        this.setupDragAndDrop();
      },

      setupDragAndDrop() {
        const container = document.querySelector('.container');
        const dropZone = document.getElementById('dropZone');
        let dragCounter = 0;

        // Prevent default drag behaviors on entire document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
          document.body.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
          }, false);
        });

        // Show drop zone when dragging over container
        container.addEventListener('dragenter', (e) => {
          dragCounter++;
          if (e.dataTransfer.types.includes('Files')) {
            container.classList.add('drag-over');
            dropZone.classList.add('active');
          }
        });

        container.addEventListener('dragleave', (e) => {
          dragCounter--;
          if (dragCounter === 0) {
            container.classList.remove('drag-over');
            dropZone.classList.remove('active');
          }
        });

        container.addEventListener('dragover', (e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
          }
        });

        container.addEventListener('drop', async (e) => {
          dragCounter = 0;
          container.classList.remove('drag-over');
          dropZone.classList.remove('active');

          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) {
            await this.uploadDroppedFiles(files);
          }
        });
      },

      async uploadDroppedFiles(files) {
        if (files.length === 0) return;

        this.showSuccess(`Uploading ${files.length} file(s)...`);

        try {
          for (const file of files) {
            const path = this.getFilePath(file.name);
            const buf = await file.arrayBuffer();

            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'x-filename': path },
              body: buf
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
          }

          this.showSuccess(`Successfully uploaded ${files.length} file(s)`);
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        const sidebar = document.getElementById('sidebar');
        if (this.sidebarVisible) {
          sidebar.classList.remove('hidden');
        } else {
          sidebar.classList.add('hidden');
        }
        localStorage.setItem('sidebarVisible', this.sidebarVisible);
      },

      async loadTree(path = '', parentElement = null) {
        if (!parentElement) {
          document.getElementById('treeView').innerHTML = '';
          parentElement = document.getElementById('treeView');
        }

        try {
          const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          
          if (data.error) throw new Error(data.error);
          
          const folders = (data.items || []).filter(item => item.isDir);
          this.treeCache[path] = folders;
          
          if (path === '') {
            // Root level
            this.renderTreeLevel(folders, parentElement, '');
          }
        } catch (e) {
          console.error('Tree load error:', e);
        }
      },

      renderTreeLevel(folders, parentElement, basePath) {
        folders.forEach(folder => {
          const folderPath = basePath ? `${basePath}/${folder.name}` : folder.name;
          const isExpanded = this.expandedFolders.has(folderPath);
          const isActive = this.currentPath === folderPath;
          
          const wrapper = document.createElement('div');
          wrapper.className = 'tree-item-wrapper';
          
          const item = document.createElement('div');
          item.className = `tree-item ${isActive ? 'active' : ''}`;
          item.innerHTML = `
            <span class="tree-toggle ${isExpanded ? 'expanded' : ''}" data-path="${folderPath}">▶</span>
            <span class="tree-icon">📁</span>
            <span class="tree-name">${this.escapeHtml(folder.name)}</span>
          `;
          
          const toggle = item.querySelector('.tree-toggle');
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTreeFolder(folderPath, wrapper);
          });
          
          item.addEventListener('click', () => {
            this.loadFiles(folderPath);
          });
          
          wrapper.appendChild(item);
          
          const childrenContainer = document.createElement('div');
          childrenContainer.className = `tree-children ${isExpanded ? 'expanded' : ''}`;
          wrapper.appendChild(childrenContainer);
          
          if (isExpanded && this.treeCache[folderPath]) {
            this.renderTreeLevel(this.treeCache[folderPath], childrenContainer, folderPath);
          }
          
          parentElement.appendChild(wrapper);
        });
      },

      async toggleTreeFolder(path, wrapperElement) {
        const toggle = wrapperElement.querySelector('.tree-toggle');
        const children = wrapperElement.querySelector('.tree-children');
        
        if (this.expandedFolders.has(path)) {
          // Collapse
          this.expandedFolders.delete(path);
          toggle.classList.remove('expanded');
          children.classList.remove('expanded');
          children.innerHTML = '';
        } else {
          // Expand
          this.expandedFolders.add(path);
          toggle.classList.add('expanded');
          children.classList.add('expanded');
          
          if (!this.treeCache[path]) {
            children.innerHTML = '<div class="loading" style="padding: 8px 16px; font-size: 12px;">Loading...</div>';
            
            try {
              const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
              const data = await res.json();
              
              if (data.error) throw new Error(data.error);
              
              const folders = (data.items || []).filter(item => item.isDir);
              this.treeCache[path] = folders;
              children.innerHTML = '';
              
              if (folders.length === 0) {
                children.innerHTML = '<div style="padding: 8px 16px; font-size: 12px; color: #999;">Empty folder</div>';
              } else {
                this.renderTreeLevel(folders, children, path);
              }
            } catch (e) {
              children.innerHTML = '<div style="padding: 8px 16px; font-size: 12px; color: #dc3545;">Error loading</div>';
            }
          } else {
            this.renderTreeLevel(this.treeCache[path], children, path);
          }
        }
      },

      updateTreeSelection() {
        document.querySelectorAll('.tree-item').forEach(item => {
          item.classList.remove('active');
        });
        
        const activeItems = document.querySelectorAll(`.tree-toggle[data-path="${this.currentPath}"]`);
        activeItems.forEach(toggle => {
          toggle.closest('.tree-item').classList.add('active');
        });
      },

      async loadFiles(path = '') {
        this.currentPath = path;
        document.getElementById('fileList').innerHTML = '<div class="loading">Loading...</div>';
        
        try {
          const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
          const data = await res.json();
          
          if (data.error) throw new Error(data.error);
          
          this.files = data.items || [];
          this.selected.clear();
          this.renderFiles();
          this.renderBreadcrumb();
          this.updateToolbar();
          this.updateTreeSelection();
        } catch (e) {
          this.showError(e.message);
          document.getElementById('fileList').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>Error loading files</div></div>';
        }
      },

      renderFiles() {
        const list = document.getElementById('fileList');
        document.getElementById('selectAll').checked = false;
        
        if (this.files.length === 0) {
          list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><div>This folder is empty</div></div>';
          return;
        }

        list.innerHTML = this.files.map((file, i) => {
          const icon = file.isDir ? '📁' : this.getFileIcon(file.name);
          const size = file.isDir ? '-' : this.formatSize(file.size);
          const date = new Date(file.mtime).toLocaleString();
          
          return `
            <div class="file-row" data-index="${i}" 
                 onclick="fm.handleRowClick(event, ${i})"
                 oncontextmenu="fm.showContextMenu(event, ${i}); return false;"
                 ondblclick="fm.handleDoubleClick(${i})">
              <div><input type="checkbox" class="checkbox" ${this.selected.has(i) ? 'checked' : ''} onclick="event.stopPropagation(); fm.toggleSelect(${i})"></div>
              <div class="file-name">
                <span class="file-icon">${icon}</span>
                <span>${this.escapeHtml(file.name)}</span>
              </div>
              <div class="file-size">${size}</div>
              <div class="file-date">${date}</div>
            </div>
          `;
        }).join('');
      },

      renderBreadcrumb() {
        const parts = this.currentPath.split('/').filter(Boolean);
        const crumbs = ['<a onclick="fm.loadFiles(\'\')">🏠 Home</a>'];
        
        let path = '';
        parts.forEach(part => {
          path += (path ? '/' : '') + part;
          const p = path;
          crumbs.push(`<span>/</span><a onclick="fm.loadFiles('${p}')">${this.escapeHtml(part)}</a>`);
        });
        
        document.getElementById('breadcrumb').innerHTML = crumbs.join(' ');
      },

      handleRowClick(e, index) {
        if (e.ctrlKey || e.metaKey) {
          this.toggleSelect(index);
        } else if (e.shiftKey && this.selected.size > 0) {
          const lastSelected = Math.max(...this.selected);
          const start = Math.min(lastSelected, index);
          const end = Math.max(lastSelected, index);
          for (let i = start; i <= end; i++) {
            this.selected.add(i);
          }
          this.renderFiles();
          this.updateToolbar();
        } else {
          this.selected.clear();
          this.selected.add(index);
          this.renderFiles();
          this.updateToolbar();
        }
      },

      handleDoubleClick(index) {
        const file = this.files[index];
        if (file.isDir) {
          this.loadFiles(this.getFilePath(file.name));
        } else {
          this.editFile(index);
        }
      },

      toggleSelect(index) {
        if (this.selected.has(index)) {
          this.selected.delete(index);
        } else {
          this.selected.add(index);
        }
        this.renderFiles();
        this.updateToolbar();
      },

      toggleSelectAll() {
        const checked = document.getElementById('selectAll').checked;
        this.selected.clear();
        if (checked) {
          this.files.forEach((_, i) => this.selected.add(i));
        }
        this.renderFiles();
        this.updateToolbar();
      },

      updateToolbar() {
        const count = this.selected.size;
        const single = count === 1;
        const singleFile = single && !this.files[[...this.selected][0]].isDir;
        
        document.getElementById('editBtn').disabled = !singleFile;
        document.getElementById('renameBtn').disabled = !single;
        document.getElementById('downloadBtn').disabled = !singleFile;
        document.getElementById('deleteBtn').disabled = count === 0;
      },

      showContextMenu(e, index) {
        e.preventDefault();
        this.contextTarget = index;
        const menu = document.getElementById('contextMenu');
        menu.style.display = 'block';
        
        // Get menu dimensions
        const menuHeight = menu.offsetHeight;
        const menuWidth = menu.offsetWidth;
        
        // Get viewport dimensions
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Calculate position
        let left = e.pageX;
        let top = e.pageY;
        
        // Adjust if menu goes beyond right edge
        if (left + menuWidth > viewportWidth) {
          left = viewportWidth - menuWidth - 10;
        }
        
        // Adjust if menu goes beyond bottom edge
        if (top + menuHeight > viewportHeight + window.scrollY) {
          top = viewportHeight + window.scrollY - menuHeight - 10;
        }
        
        // Ensure menu doesn't go above viewport
        if (top < window.scrollY) {
          top = window.scrollY + 10;
        }
        
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
      },

      hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
      },

      openContextItem() {
        if (this.contextTarget !== null) {
          this.handleDoubleClick(this.contextTarget);
        }
      },

      editContextItem() {
        if (this.contextTarget !== null) {
          this.editFile(this.contextTarget);
        }
      },

      renameContextItem() {
        if (this.contextTarget !== null) {
          this.selected.clear();
          this.selected.add(this.contextTarget);
          this.renameSelected();
        }
      },

      downloadContextItem() {
        if (this.contextTarget !== null) {
          this.selected.clear();
          this.selected.add(this.contextTarget);
          this.downloadSelected();
        }
      },

      deleteContextItem() {
        if (this.contextTarget !== null) {
          this.selected.clear();
          this.selected.add(this.contextTarget);
          this.deleteSelected();
        }
      },

      moveContextItem() {
        if (this.contextTarget !== null) {
          const file = this.files[this.contextTarget];
          this.currentMoveFile = file.name;
          document.getElementById('movePath').value = '';
          this.showModal('moveModal');
        }
      },

      copyContextItem() {
        if (this.contextTarget !== null) {
          const file = this.files[this.contextTarget];
          this.currentCopyFile = file.name;
          document.getElementById('copyPath').value = '';
          document.getElementById('copyNewName').value = '';
          this.showModal('copyModal');
        }
      },

      changePermissionsContextItem() {
        if (this.contextTarget !== null) {
          const file = this.files[this.contextTarget];
          this.currentPermFile = file.name;
          document.getElementById('permissionMode').value = '755';
          this.showModal('permissionsModal');
        }
      },

      compressContextItem() {
        if (this.contextTarget !== null) {
          const file = this.files[this.contextTarget];
          this.currentCompressFile = file.name;
          document.getElementById('archiveName').value = file.name + '.zip';
          this.showModal('compressModal');
        }
      },

      passwordProtectContextItem() {
        if (this.contextTarget !== null) {
          const file = this.files[this.contextTarget];
          this.currentProtectFile = file.name;
          document.getElementById('protectUsername').value = '';
          document.getElementById('protectPassword').value = '';
          document.getElementById('protectPasswordConfirm').value = '';
          this.showModal('passwordModal');
        }
      },

      leechProtectContextItem() {
        if (this.contextTarget !== null) {
          const file = this.files[this.contextTarget];
          this.currentLeechFile = file.name;
          document.getElementById('leechDomains').value = '';
          this.showModal('leechModal');
        }
      },

      manageIndicesContextItem() {
        if (this.contextTarget !== null) {
          const file = this.files[this.contextTarget];
          if (file.isDir) {
            this.currentIndicesFolder = file.name;
            document.getElementById('indicesFiles').value = 'index.html\nindex.php\ndefault.html';
            document.getElementById('indicesAutoIndex').checked = false;
            this.showModal('indicesModal');
          } else {
            this.showError('This feature is only available for directories');
          }
        }
      },

      async doMove() {
        const destPath = document.getElementById('movePath').value.trim();
        if (!destPath) return this.showError('Please enter destination path');
        
        const from = this.getFilePath(this.currentMoveFile);
        const to = destPath + '/' + this.currentMoveFile;
        
        try {
          const res = await fetch('/api/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          this.showSuccess('Moved successfully');
          this.closeModal('moveModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      async doCopy() {
        const destPath = document.getElementById('copyPath').value.trim();
        const newName = document.getElementById('copyNewName').value.trim() || this.currentCopyFile;
        
        if (!destPath) return this.showError('Please enter destination path');
        
        const from = this.getFilePath(this.currentCopyFile);
        const to = destPath + '/' + newName;
        
        try {
          // Read source file
          const res = await fetch(`/api/file?path=${encodeURIComponent(from)}`);
          const data = await res.json();
          
          if (data.error) throw new Error(data.error);
          
          // Write to destination
          const saveRes = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: to, content: data.content })
          });
          
          const saveData = await saveRes.json();
          if (saveData.error) throw new Error(saveData.error);
          
          this.showSuccess('Copied successfully');
          this.closeModal('copyModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      async doChangePermissions() {
        const mode = document.getElementById('permissionMode').value.trim();
        if (!mode || !/^[0-7]{3,4}$/.test(mode)) {
          return this.showError('Invalid permission mode. Use format like 755 or 644');
        }
        
        this.showSuccess(`Permissions changed to ${mode} (Note: Backend implementation needed)`);
        this.closeModal('permissionsModal');
      },

      async doCompress() {
        const archiveName = document.getElementById('archiveName').value.trim();
        const type = document.getElementById('compressionType').value;
        
        if (!archiveName) return this.showError('Please enter archive name');
        
        this.showSuccess(`Compressing to ${archiveName} (Note: Backend implementation needed)`);
        this.closeModal('compressModal');
      },

      async doPasswordProtect() {
        const username = document.getElementById('protectUsername').value.trim();
        const password = document.getElementById('protectPassword').value;
        const confirm = document.getElementById('protectPasswordConfirm').value;
        
        if (!username || !password) return this.showError('Please fill all fields');
        if (password !== confirm) return this.showError('Passwords do not match');
        
        this.showSuccess('Password protection enabled (Note: Backend implementation needed)');
        this.closeModal('passwordModal');
      },

      async doLeechProtect() {
        const mode = document.getElementById('leechMode').value;
        const domains = document.getElementById('leechDomains').value.trim();
        
        if (!domains) return this.showError('Please enter allowed domains');
        
        this.showSuccess(`Leech protection enabled with ${mode} mode (Note: Backend implementation needed)`);
        this.closeModal('leechModal');
      },

      async doManageIndices() {
        const files = document.getElementById('indicesFiles').value.trim();
        const autoIndex = document.getElementById('indicesAutoIndex').checked;
        
        if (!files) return this.showError('Please specify at least one index file');
        
        this.showSuccess('Index settings saved (Note: Backend implementation needed)');
        this.closeModal('indicesModal');
      },

      async editFile(index) {
        const file = this.files[index];
        if (file.isDir) return;
        
        try {
          const res = await fetch(`/api/file?path=${encodeURIComponent(this.getFilePath(file.name))}`);
          const data = await res.json();
          
          if (data.error) throw new Error(data.error);
          
          document.getElementById('editTitle').textContent = `Edit: ${file.name}`;
          document.getElementById('editContent').value = data.content;
          this.currentEditFile = file.name;
          this.showModal('editModal');
        } catch (e) {
          this.showError(e.message);
        }
      },

      async saveFile() {
        const content = document.getElementById('editContent').value;
        const path = this.getFilePath(this.currentEditFile);
        
        try {
          const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          this.showSuccess('File saved successfully');
          this.closeModal('editModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      editSelected() {
        if (this.selected.size === 1) {
          this.editFile([...this.selected][0]);
        }
      },

      renameSelected() {
        if (this.selected.size === 1) {
          const index = [...this.selected][0];
          const file = this.files[index];
          document.getElementById('renameName').value = file.name;
          this.currentRenameFile = file.name;
          this.showModal('renameModal');
        }
      },

      async doRename() {
        const newName = document.getElementById('renameName').value.trim();
        if (!newName) return this.showError('Please enter a name');
        
        const from = this.getFilePath(this.currentRenameFile);
        const to = this.getFilePath(newName);
        
        try {
          const res = await fetch('/api/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          this.showSuccess('Renamed successfully');
          this.closeModal('renameModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      downloadSelected() {
        if (this.selected.size === 1) {
          const index = [...this.selected][0];
          const file = this.files[index];
          if (!file.isDir) {
            window.open(`/api/download?path=${encodeURIComponent(this.getFilePath(file.name))}`, '_blank');
          }
        }
      },

      async deleteSelected() {
        if (this.selected.size === 0) return;
        
        const files = [...this.selected].map(i => this.files[i]);
        const fileNames = files.map(f => f.name);
        
        // Show confirmation modal
        const message = this.selected.size === 1 
          ? 'Are you sure you want to delete this item?' 
          : `Are you sure you want to delete ${this.selected.size} items?`;
        
        document.getElementById('deleteMessage').textContent = message;
        
        const detailsHtml = fileNames.map(name => {
          const file = files.find(f => f.name === name);
          const icon = file.isDir ? '📁' : '📄';
          return `<div class="confirm-file-item">${icon} ${this.escapeHtml(name)}</div>`;
        }).join('');
        
        document.getElementById('deleteDetails').innerHTML = detailsHtml;
        this.showModal('deleteConfirmModal');
      },

      async confirmDelete() {
        try {
          for (const index of this.selected) {
            const file = this.files[index];
            const res = await fetch('/api/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: this.getFilePath(file.name) })
            });
            
            const data = await res.json();
            if (data.error) throw new Error(data.error);
          }
          
          this.showSuccess('Deleted successfully');
          this.closeModal('deleteConfirmModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      showUploadDialog() {
        document.getElementById('fileInput').value = '';
        document.getElementById('uploadList').innerHTML = '';
        this.showModal('uploadModal');
      },

      handleFileSelect(e) {
        const files = Array.from(e.target.files);
        const list = document.getElementById('uploadList');
        list.innerHTML = files.map(f => `<div>📄 ${this.escapeHtml(f.name)} (${this.formatSize(f.size)})</div>`).join('');
      },

      async uploadFiles() {
        const input = document.getElementById('fileInput');
        const files = Array.from(input.files);
        
        if (files.length === 0) return this.showError('No files selected');
        
        try {
          for (const file of files) {
            const path = this.getFilePath(file.name);
            const buf = await file.arrayBuffer();
            
            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'x-filename': path },
              body: buf
            });
            
            const data = await res.json();
            if (data.error) throw new Error(data.error);
          }
          
          this.showSuccess(`Uploaded ${files.length} file(s)`);
          this.closeModal('uploadModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      showNewFolderDialog() {
        document.getElementById('folderName').value = '';
        this.showModal('folderModal');
      },

      async createFolder() {
        const name = document.getElementById('folderName').value.trim();
        if (!name) return this.showError('Please enter a folder name');
        
        const path = this.getFilePath(name);
        
        try {
          const res = await fetch('/api/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          this.showSuccess('Folder created');
          this.closeModal('folderModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      showNewFileDialog() {
        document.getElementById('fileName').value = '';
        document.getElementById('fileContent').value = '';
        this.showModal('fileModal');
      },

      async createFile() {
        const name = document.getElementById('fileName').value.trim();
        const content = document.getElementById('fileContent').value;
        
        if (!name) return this.showError('Please enter a file name');
        
        const path = this.getFilePath(name);
        
        try {
          const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          this.showSuccess('File created');
          this.closeModal('fileModal');
          await this.loadFiles(this.currentPath);
        } catch (e) {
          this.showError(e.message);
        }
      },

      goUp() {
        if (!this.currentPath) return;
        const parts = this.currentPath.split('/');
        parts.pop();
        this.loadFiles(parts.join('/'));
      },

      refresh() {
        this.loadFiles(this.currentPath);
        this.treeCache = {};
        this.loadTree();
      },

      getFilePath(name) {
        return this.currentPath ? `${this.currentPath}/${name}` : name;
      },

      getFileIcon(name) {
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
          php: '🐘',
          js: '📜',
          json: '📋',
          html: '🌐',
          css: '🎨',
          jpg: '🖼️',
          jpeg: '🖼️',
          png: '🖼️',
          gif: '🖼️',
          pdf: '📕',
          doc: '📘',
          docx: '📘',
          zip: '📦',
          rar: '📦',
          '7z': '📦',
          mp3: '🎵',
          mp4: '🎬',
          avi: '🎬',
          txt: '📄',
          md: '📝'
        };
        return icons[ext] || '📄';
      },

      formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
      },

      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      },

      showModal(id) {
        document.getElementById(id).classList.add('show');
      },

      closeModal(id) {
        document.getElementById(id).classList.remove('show');
      },

      showSuccess(msg) {
        this.showMessage(msg, false);
      },

      showError(msg) {
        this.showMessage(msg, true);
      },

      showMessage(msg, isError) {
        const div = document.createElement('div');
        div.className = 'status-message' + (isError ? ' error' : '');
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
      }
    };

    fm.init();