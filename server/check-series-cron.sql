-- 检查追剧任务的 cron 设置
-- 显示所有追剧订阅及其当前的 cron 设置

SELECT 
    s.id as subscription_id,
    s.name as series_name,
    s.check_interval,
    t.id as task_id,
    t.cron as current_cron,
    t.enabled,
    CASE 
        WHEN s.check_interval >= 7 THEN '0 */2 * * *'
        WHEN s.check_interval >= 3 THEN '0 * * * *'
        ELSE '*/30 * * * *'
    END as correct_cron,
    CASE 
        WHEN t.cron = (
            CASE 
                WHEN s.check_interval >= 7 THEN '0 */2 * * *'
                WHEN s.check_interval >= 3 THEN '0 * * * *'
                ELSE '*/30 * * * *'
            END
        ) THEN '✓ 正确'
        ELSE '✗ 需要修复'
    END as status
FROM series_subscriptions s
LEFT JOIN tasks t ON s.task_id = t.id
WHERE t.id IS NOT NULL
ORDER BY s.check_interval DESC, s.name;
