
# 如何將專案上傳到 GitHub (完整步驟指南)

當您無法上傳專案時，通常是因為本地的 Git 設定尚未與 GitHub 上的儲存庫正確連接。請依照以下步驟操作，即可解決問題。

---

### **第一步：在您的電腦上設定 Git**

如果您是第一次為這個專案設定 Git，請執行以下步驟。如果已經做過，可以跳到第二步。

1.  **開啟終端機 (Terminal)**。
    *   在 Windows 上，您可以使用 Git Bash 或 PowerShell。
    *   在 macOS 上，請使用「終端機」應用程式。

2.  使用 `cd` 指令移動到您存放這個專案的資料夾。例如：`cd path/to/your/project`

3.  **初始化 Git 儲存庫**：
    ```bash
    # --initial-branch=main 會直接建立名為 main 的主要分支
    git init --initial-branch=main
    ```

4.  **將所有檔案加入 Git 追蹤**：
    ```bash
    git add .
    ```

5.  **建立您的第一個本地提交 (commit)**，這是您專案的一個快照：
    ```bash
    git commit -m "專案初始版本"
    ```

---

### **第二步：連接到 GitHub 上的儲存庫**

1.  **前往 GitHub 網站，建立一個新的、空的儲存庫 (repository)**。
    *   **非常重要**：建立時**不要**勾選 "Add a README file", "Add .gitignore", 或 "Choose a license" 等任何選項。一個**完全空白**的儲存庫是最好的。

2.  建立後，複製 GitHub 頁面上提供的儲存庫網址。它看起來會像這樣：`https://github.com/您的使用者名稱/您的儲存庫名稱.git`

3.  **回到您的終端機**，將本地儲存庫與 GitHub 上的遠端儲存庫連接起來。
    *   如果您是**第一次**設定，請執行：
        ```bash
        # 把 [貼上您的 GitHub 儲存庫網址] 換成您剛剛複製的網址
        git remote add origin [貼上您的 GitHub 儲存庫網址]
        ```
    *   如果您之前設定錯誤，想**更換網址**，請執行：
        ```bash
        git remote set-url origin [貼上您正確的 GitHub 儲存庫網址]
        ```

---

### **第三步：上傳您的程式碼**

現在，一切都準備就緒了，可以進行上傳。

*   **如果您在第二步建立的是一個完全空的儲存庫**，請直接執行：
    ```bash
    git push -u origin main
    ```

*   **如果您在 GitHub 建立儲存庫時，不小心也建立了檔案 (例如 README.md)**，直接 `push` 會失敗，並顯示 "unrelated histories" (無關的歷史紀錄) 錯誤。
    請改用以下兩個指令來強制合併並上傳：

    1.  先拉取遠端變更，並允許合併無關的歷史紀錄 (這是您之前問過的指令)：
        ```bash
        git pull origin main --allow-unrelated-histories
        ```
    2.  現在，再重新上傳一次：
        ```bash
        git push -u origin main
        ```

---

執行完以上步驟後，重新整理您在 GitHub 上的儲存庫頁面，就會看到您的所有專案檔案都已經成功上傳了！
