import Layout from "@/components/Layout";

export default function CommercialTransactionLawPage() {
  return (
    <Layout>
      <div className="w-full mx-auto px-4 md:px-0 py-8 md:py-12">
        <div className="max-w-[327px] md:max-w-[920px] mx-auto space-y-8 md:space-y-12">
          <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
            <h1 className="text-[15px] md:text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              特定商取引法に基づく表記
            </h1>
          </div>

          <div className="space-y-6 text-[12px] md:text-[13px] text-[#444444] tracking-[0.06em] leading-[1.65] font-zen-kaku-gothic">
            <section>
              <h2 className="font-medium">事業者</h2>
              <p>東京都新宿区百人町2-20-24</p>
            </section>

            <section>
              <h2 className="font-medium">運営統括責任者</h2>
              <p>junten株式会社</p>
              <p>代表取締役 弦間潤子</p>
            </section>

            <section>
              <h2 className="font-medium">Webサイト</h2>
              <p>https://etoehotel.com</p>
            </section>

            <section>
              <h2 className="font-medium">メールアドレス</h2>
              <p>info@etoehotel.com</p>
            </section>

            <section>
              <h2 className="font-medium">TEL</h2>
              <p>03-6279-3033</p>
            </section>

            <section>
              <h2 className="font-medium">商品の販売価格</h2>
              <p>
                当社ウェブサイトまたは各サービスの予約ページに、税込価格にて掲示しております。
              </p>
            </section>

            <section>
              <h2 className="font-medium">お支払い方法・お支払い時期</h2>
              <p>クレジットカード決済をご利用いただけます。</p>
            </section>

            <section>
              <h2 className="font-medium">商品等の引き渡し</h2>
              <p>
                予約ページからのお手続きが完了した時点で、予約が確定されます。
              </p>
            </section>

            <section>
              <h2 className="font-medium">代金のお支払時期および方法</h2>
              <p>
                購入契約が成立した際、原則として事前決済を行います
                <br />
                （お支払いの請求日はご利用のクレジットカード会社により異なります）。
              </p>
            </section>

            <section>
              <h2 className="font-medium">キャンセル等に関する特約</h2>
              <p>
                キャンセルの際は、下記のキャンセル料が適用されますのでご注意ください。
              </p>
            </section>

            <section>
              <h2 className="font-medium">キャンセル時期</h2>
              <p>ご利用開始日時の48時間前以降：利用料の100％</p>
            </section>

            <section>
              <h2 className="font-medium">返金に関して</h2>
              <p>
                特別な事情により返金が必要となった場合は、ご利用のクレジットカード会社の返金規約に基づき処理いたします。
                <br />
                ※返金の時期につきましては、各クレジットカード会社の処理スケジュールにより異なります。
              </p>
            </section>

            <section>
              <h2 className="font-medium">商品代金以外に必要な料金</h2>
              <p>
                ウェブサイトの閲覧やコンテンツのダウンロード、お問い合わせなどで電子メールを送受信する際、通信事業者との間で所定の通信料金が発生する場合があります。
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
