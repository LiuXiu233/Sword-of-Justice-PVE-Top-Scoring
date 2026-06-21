import os

from playwright.sync_api import expect, sync_playwright


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        page.goto(os.environ.get("APP_URL", "http://127.0.0.1:5174"))
        page.wait_for_load_state("networkidle")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_load_state("networkidle")

        expect(page.get_by_role("heading", name="记分与多人对比")).to_be_visible()
        expect(page.get_by_role("button", name="单周 + 上周积分")).to_be_visible()
        expect(page.locator(".project-setting-card")).to_have_count(5)
        expect(page.locator(".project-setting-card").last.locator("select")).to_have_value("max2500Raid")

        first_row = page.locator(".player-row").first
        first_row.locator('input[type="text"]').fill("甲")
        first_row.locator('input[type="number"]').nth(0).fill("1000")
        expect(page.locator(".score-cell").filter(has_text="23,000").first).to_be_visible()

        page.get_by_role("button", name="添加项目").click()
        expect(page.locator(".project-setting-card")).to_have_count(6)
        expect(page.locator(".score-cell").filter(has_text="25,500").first).to_be_visible()

        page.locator(".project-setting-card").last.locator("select").select_option("max6000")
        expect(page.locator(".score-cell").filter(has_text="29,000").first).to_be_visible()

        page.locator(".project-setting-card").last.get_by_role("button", name="删除").click()
        expect(page.locator(".project-setting-card")).to_have_count(5)
        expect(page.locator(".score-cell").filter(has_text="23,000").first).to_be_visible()

        page.locator(".project-toggle").filter(has_text="燃心画境·团本").click()
        expect(page.locator(".score-cell").filter(has_text="20,500").first).to_be_visible()
        expect(page.locator(".mini-score-grid").first.filter(has_text="未计")).to_be_visible()

        page.get_by_role("button", name="周成绩换积分").click()
        expect(page.locator(".score-cell").filter(has_text="19,500").first).to_be_visible()
        first_row.locator('input[type="number"]').first.fill("0")
        expect(first_row.get_by_text("无排名")).to_be_visible()
        expect(page.locator(".score-cell").filter(has_text="17,000").first).to_be_visible()

        page.get_by_role("button", name="两周周成绩").click()
        expect(page.locator(".score-cell").filter(has_text="39,000").first).to_be_visible()

        page.get_by_role("button", name="添加成员").click()
        expect(page.locator(".player-row")).to_have_count(4)
        expect(page.locator(".lookup-result-grid .lookup-card")).to_have_count(5)
        expect(page.locator(".lookup-score").filter(has_text="22,000")).to_be_visible()
        page.locator(".rule-panel input").fill("13")
        expect(page.locator(".lookup-score").filter(has_text="19,800")).to_be_visible()
        expect(page.locator(".lookup-card").filter(has_text="5,400").first).to_be_visible()
        page.locator(".rule-panel input").fill("37")
        expect(page.locator(".lookup-score").filter(has_text="16,983")).to_be_visible()
        expect(page.locator(".lookup-card").filter(has_text="1,928")).to_be_visible()
        page.locator(".rule-panel input").fill("0")
        expect(page.locator(".lookup-score").filter(has_text="0")).to_be_visible()
        expect(page.locator(".lookup-card").filter(has_text="无排名")).to_have_count(5)

        page.screenshot(path="/tmp/nishuihan-score-tool.png", full_page=True)
        assert not console_errors, console_errors
        browser.close()


if __name__ == "__main__":
    main()
