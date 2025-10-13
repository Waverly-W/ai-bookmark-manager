// Chrome API 调试脚本
// 在浏览器控制台中运行此脚本来检查Chrome API是否正常工作

console.log('=== Chrome API 调试信息 ===');

// 检查基本API可用性
console.log('1. Chrome API 可用性检查:');
console.log('  chrome:', !!window.chrome);
console.log('  chrome.bookmarks:', !!window.chrome?.bookmarks);
console.log('  chrome.storage:', !!window.chrome?.storage);
console.log('  chrome.runtime:', !!window.chrome?.runtime);

// 检查书签API
if (window.chrome?.bookmarks) {
    console.log('\n2. 测试书签API:');
    
    // 获取书签树
    chrome.bookmarks.getTree()
        .then(tree => {
            console.log('  ✅ getTree() 成功:', tree);
            console.log('  书签根节点数量:', tree.length);
            
            if (tree[0] && tree[0].children) {
                console.log('  根节点子项数量:', tree[0].children.length);
                
                // 测试获取第一个文件夹的子树
                const firstFolder = tree[0].children.find(child => !child.url);
                if (firstFolder) {
                    console.log('  测试文件夹:', firstFolder.title, firstFolder.id);
                    
                    chrome.bookmarks.getSubTree(firstFolder.id)
                        .then(subTree => {
                            console.log('  ✅ getSubTree() 成功:', subTree);
                        })
                        .catch(error => {
                            console.error('  ❌ getSubTree() 失败:', error);
                        });
                }
            }
        })
        .catch(error => {
            console.error('  ❌ getTree() 失败:', error);
        });
} else {
    console.log('\n2. ❌ 书签API不可用');
}

// 检查存储API
if (window.chrome?.storage) {
    console.log('\n3. 测试存储API:');
    
    chrome.storage.local.get(null)
        .then(items => {
            console.log('  ✅ storage.local.get() 成功');
            console.log('  存储的项目:', Object.keys(items));
        })
        .catch(error => {
            console.error('  ❌ storage.local.get() 失败:', error);
        });
} else {
    console.log('\n3. ❌ 存储API不可用');
}

// 检查运行时API
if (window.chrome?.runtime) {
    console.log('\n4. 运行时信息:');
    console.log('  扩展ID:', chrome.runtime.id);
    console.log('  manifest:', chrome.runtime.getManifest());
} else {
    console.log('\n4. ❌ 运行时API不可用');
}

// 检查页面环境
console.log('\n5. 页面环境信息:');
console.log('  URL:', window.location.href);
console.log('  User Agent:', navigator.userAgent);
console.log('  是否在扩展环境:', window.location.protocol === 'chrome-extension:');

console.log('\n=== 调试信息结束 ===');
