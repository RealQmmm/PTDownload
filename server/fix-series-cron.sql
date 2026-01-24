-- 修复追剧任务的 cron 设置
-- 根据 check_interval 更新 cron 表达式

-- 1. 修复 check_interval >= 7 天的任务（应该每2小时检查一次）
UPDATE tasks 
SET cron = '0 */2 * * *'
WHERE id IN (
    SELECT t.id 
    FROM tasks t
    JOIN series_subscriptions s ON t.id = s.task_id
    WHERE s.check_interval >= 7 AND t.cron != '0 */2 * * *'
);

-- 2. 修复 check_interval >= 3 天的任务（应该每小时检查一次）
UPDATE tasks 
SET cron = '0 * * * *'
WHERE id IN (
    SELECT t.id 
    FROM tasks t
    JOIN series_subscriptions s ON t.id = s.task_id
    WHERE s.check_interval >= 3 AND s.check_interval < 7 AND t.cron != '0 * * * *'
);

-- 3. 修复 check_interval < 3 天的任务（应该每30分钟检查一次）
UPDATE tasks 
SET cron = '*/30 * * * *'
WHERE id IN (
    SELECT t.id 
    FROM tasks t
    JOIN series_subscriptions s ON t.id = s.task_id
    WHERE s.check_interval < 3 AND t.cron != '*/30 * * * *'
);

-- 显示修复结果
SELECT 
    s.name as series_name,
    s.check_interval,
    t.cron as updated_cron,
    CASE 
        WHEN s.check_interval >= 7 THEN '每2小时'
        WHEN s.check_interval >= 3 THEN '每小时'
        ELSE '每30分钟'
    END as frequency
FROM series_subscriptions s
LEFT JOIN tasks t ON s.task_id = t.id
WHERE t.id IS NOT NULL
ORDER BY s.check_interval DESC;
