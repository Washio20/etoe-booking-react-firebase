import React, { useState } from "react";

interface FacilityGuideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: "STAY" | "DAYUSE"; // STAY for external-card-view, DAYUSE for card-view
}

export default function FacilityGuideDialog({
  isOpen,
  onClose,
  type,
}: FacilityGuideDialogProps) {
  const [language, setLanguage] = useState<"JP" | "EN">("JP");

  if (!isOpen) return null;

  const renderStayContent = () => {
    if (language === "JP") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 font-zen-kaku-gothic font-bold">
            ご滞在前にご一読くださいませ。
          </p>

          <section className="space-y-2">
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■
              自動チェックインができます。ご予約時間の5分前からQRキーが有効になります。
              ご滞在中にご不明点やご用件がございましたら、お気軽に1階ラウンジのベルを押すか、
              <a
                href="https://season-airbus-cad.notion.site/room-guide-contact-20a196c0a6318096b573d329bdc2663e#20f196c0a631806d8ba9dd0bf4a5d063"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                CONTACT
              </a>
              よりお気軽にご連絡ください。
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■
              退室の際は、客室扉のQRをスキャンして「チェックアウト」を押してください。操作がない場合、延長料金が発生することがあります。
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ 全館禁煙となっております。喫煙所のご用意はございません。
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ お荷物預かりは9am～11pmで受け付けております。
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■
              連泊の方を対象に、清掃をリクエスト制で承っております（1日1回まで）。ご希望の際は、外出時に1Fラウンジのベルボタンでスタッフへお知らせください。
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ プライベートサウナのご予約の詳細は、お部屋にあるROOM
              GUIDEをご覧ください。予約の際は、1Fのベルボタンでスタッフに直接お声がけいただくか、
              <a
                href="https://season-airbus-cad.notion.site/room-guide-contact-20a196c0a6318096b573d329bdc2663e#20f196c0a631806d8ba9dd0bf4a5d063"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                CONTACT
              </a>
              よりご連絡ください。水着をご希望の方は、レンタルできます。（1着1000円）
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ ランドリーサービス、延長利用などは上記
              <a
                href="https://season-airbus-cad.notion.site/room-guide-contact-20a196c0a6318096b573d329bdc2663e#20b196c0a6318077a6cec2a2fa5c6f47"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                よくある質問[FAQ]
              </a>
              をご覧ください。ご不明点があればお気軽にご連絡ください。
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ ドリンクは1Fラウンジにて販売してます（セルフキャッシュレス対応）
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic font-medium">
              ■ WI-FI：etoe　PASS：etoehotel
            </p>
          </section>
        </div>
      );
    } else {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 font-bold">
            Please read before your stay
          </p>

          <section className="space-y-2">
            <p className="text-sm text-gray-700">
              ■ Please note that check-in is self-service. Your QR key will be
              activated 5 minutes before your reservation time. Should you need
              any assistance or have any questions during your stay, please feel
              free to press the bell at the front desk or contact us via
              <a
                href="https://season-airbus-cad.notion.site/room-guide-contact-20a196c0a6318096b573d329bdc2663e#20f196c0a631806d8ba9dd0bf4a5d063"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {" "}
                CONTACT
              </a>
              .
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700">
              ■ When leaving, please scan the QR code on the room door and press
              &quot;Check-out.&quot; If this step is skipped, additional charges
              may apply.
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700">
              ■ Smoking is strictly prohibited throughout the entire building.
              There is no designated smoking area.
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700">
              ■ Luggage storage is available from 9am to 11pm.
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700">
              ■ Housekeeping: We offer housekeeping for guests staying multiple
              nights upon request (once per day). If you would like this
              service, please press the bell button in the 1F lounge when you go
              out to notify our staff.
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700">
              ■ Private Sauna: For details, please refer to the ROOM GUIDE in
              your room. To make a reservation, press the bell button at the 1F
              lounge or contact us via
              <a
                href="https://season-airbus-cad.notion.site/room-guide-contact-20a196c0a6318096b573d329bdc2663e#20f196c0a631806d8ba9dd0bf4a5d063"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {" "}
                CONTACT
              </a>
              . Swimsuits are available for rental (¥1000 each) at the 1F
              lounge.
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700">
              ■ For laundry service, stay extension, and other common questions,
              please check our
              <a
                href="https://season-airbus-cad.notion.site/room-guide-contact-20a196c0a6318096b573d329bdc2663e#20b196c0a6318077a6cec2a2fa5c6f47"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {" "}
                FAQ
              </a>
              . If you have any other inquiries, feel free to contact us.
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700">
              ■ Drinks are available for purchase at the 1F lounge
              (self-service, cashless only).
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-700 font-medium">
              ■ Wi-Fi: etoe　　PASS: etoehotel
            </p>
          </section>
        </div>
      );
    }
  };

  const renderDayuseContent = () => {
    if (language === "JP") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 font-zen-kaku-gothic font-bold">
            ご利用前にご一読くださいませ
          </p>

          <section className="space-y-2">
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■
              セルフチェックインとなります。ご予約時間の5分前からQR鍵が有効になります。
            </p>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ 全館禁煙（電子タバコ含む）です。喫煙所のご用意はございません。
            </p>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ 館内サービスは、客室内のQRコードからご確認いただけます。
            </p>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■
              ご退室の際は、客室扉のQRをスキャンし、「チェックアウト」を押してください。操作がない場合、延長料金が発生することがあります。
            </p>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■ Wi-Fi：etoe　　PASS：etoehotel
            </p>
          </section>

          <section className="pt-4">
            <h4 className="text-sm font-bold text-gray-800 font-zen-kaku-gothic mb-2">
              サウナ/日帰り客室の利用方法
            </h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                ■
                サウナをご利用の方は、入口で靴を脱ぎ、予約した部屋の靴箱をご利用ください。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                ■
                ロウリュ水をかけすぎるとストーブが故障し、電源がおちます。サウナ室に掲示してあるルールに沿ってご利用ください。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                ■
                サウナ＋客室セットプランの方は、サウナ後バスローブで客室へご移動いただけます。ご移動の際、ご自身の靴は忘れずに客室へお持ちください。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                ■
                サウナのご延長：後ろに空き枠を予約すると、連続して2枠ご利用いただけます。
              </p>
              <p className="text-sm text-gray-700 font-zen-kaku-gothic">
                ■ 客室のご延長：お気軽にフロントデスクまでお問い合わせください。
              </p>
            </div>
          </section>

          <section className="pt-4">
            <h4 className="text-sm font-bold text-gray-800 font-zen-kaku-gothic mb-2">
              ドリンク・レンタル水着の購入方法
            </h4>
            <p className="text-sm text-gray-700 font-zen-kaku-gothic">
              ■
              1Fラウンジにて販売しています。ベルを押してスタッフまでお声がけください。レンタル水着は使用後、ソファにおいてご返却ください。
            </p>
          </section>
        </div>
      );
    } else {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 font-bold">
            Please read before use
          </p>

          <section className="space-y-2">
            <p className="text-sm text-gray-700">
              ■ Check-in is self-service. Your QR key will be activated 5
              minutes before your reservation time.
            </p>
            <p className="text-sm text-gray-700">
              ■ Smoking is strictly prohibited throughout the property
              (including electronic cigarettes). No smoking area is available.
            </p>
            <p className="text-sm text-gray-700">
              ■ Facility services can be accessed via the QR code provided in
              your room.
            </p>
            <p className="text-sm text-gray-700">
              ■ When checking out, please scan the QR code at your room door and
              press &quot;Check-out.&quot; If not completed, additional charges
              may apply.
            </p>
            <p className="text-sm text-gray-700">
              ■ Wi-Fi: etoe　　PASS: etoehotel
            </p>
          </section>

          <section className="pt-4">
            <h4 className="text-sm font-bold text-gray-800 mb-2">
              How to use the Sauna / Day-use Rooms
            </h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                ■ Please remove your shoes at the entrance and use the shoe
                locker of your reserved room.
              </p>
              <p className="text-sm text-gray-700">
                ■ Pouring excessive löyly water may damage the stove and cause a
                power outage. Please follow the rules posted inside the sauna
                room.
              </p>
              <p className="text-sm text-gray-700">
                ■ For sauna + guestroom package guests: after your sauna
                session, you may move to your guestroom in a bathrobe. Please
                remember to bring your own shoes with you.
              </p>
              <p className="text-sm text-gray-700">
                ■ Sauna extension: If there is an available slot after your
                reservation, you may book it to extend your sauna session
                consecutively.
              </p>
              <p className="text-sm text-gray-700">
                ■ Guestroom extension: Please feel free to contact the front
                desk.
              </p>
            </div>
          </section>

          <section className="pt-4">
            <h4 className="text-sm font-bold text-gray-800 mb-2">
              How to Purchase Drinks & Rent Swimsuits
            </h4>
            <p className="text-sm text-gray-700">
              ■ Available for purchase at the 1F lounge. Please press the bell
              to call our staff. Rental swimsuits should be returned by placing
              them on the sofa after use.
            </p>
          </section>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="bg-[#8A7A6A] text-white px-6 py-4">
          <h2 className="text-xl font-bold font-zen-kaku-gothic">
            CHECK-IN INFO｜ご利用案内
          </h2>
        </div>

        {/* ランゲージスイッチ */}
        <div className="bg-gray-100 px-3 sm:px-6 py-3 flex justify-between items-center">
          <div className="text-sm font-medium text-gray-700">
            {type === "STAY" ? "STAY（宿泊）" : "DAYUSE（日帰り）"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage("JP")}
              className={`px-3 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
                language === "JP"
                  ? "bg-[#8A7A6A] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-200"
              }`}
            >
              JP
            </button>
            <button
              onClick={() => setLanguage("EN")}
              className={`px-3 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
                language === "EN"
                  ? "bg-[#8A7A6A] text-white"
                  : "bg-white text-gray-700 hover:bg-gray-200"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto flex-1">
          {type === "STAY" ? renderStayContent() : renderDayuseContent()}
        </div>

        {/* 閉じるボタン */}
        <div className="px-6 py-3">
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-[#8A7A6A] text-white rounded-full hover:bg-[#7A6A5A] transition-colors font-medium font-zen-kaku-gothic"
            >
              {language === "JP" ? "確認しました" : "Confirmed"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
