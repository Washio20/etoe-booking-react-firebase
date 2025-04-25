"use client";

import Image from "next/image";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="border-t border-[#BBBBBB] bg-[#FAF9F7]">
      {/* PC端布局 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 hidden sm:block">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            {/* <h3 className="text-xl tracking-[0.1em] font-medium text-[#444444] font-['Avenir_Next']">
              etoe hotel
            </h3> */}
            <div className="flex items-center space-x-3">
              {/* <Image
                src="/images/image6.png"
                alt="Hotel Image 1"
                width={40}
                height={40}
                className="rounded-lg"
              /> */}
              <Link
                href="https://www.instagram.com/etoe_tokyo"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/images/image7.png"
                  alt="Hotel Image 2"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              </Link>
              <Link
                href="https://etoehotel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-2 text-sm text-[#444444] border border-[#444444] rounded-full hover:bg-gray-50 font-zen-kaku-gothic"
              >
                公式サイトはこちら
              </Link>
            </div>
          </div>
          <div className="text-center">
            <Link
              href="/commercial-transaction-law"
              className="text-sm text-[#444444] hover:text-gray-900 font-zen-kaku-gothic tracking-[0.06em]"
            >
              特定商取引法に基づく表記
            </Link>
            {/* <div className="mt-4">
              <Image
                src="/images/image23.png"
                alt="Footer Logo"
                width={188}
                height={40}
                className="w-auto h-10"
              />
            </div> */}
          </div>
        </div>
      </div>

      {/* 手机端布局 */}
      <div className="px-4 py-8 sm:hidden">
        <div className="flex flex-col items-center space-y-8">
          <div className="flex flex-col items-center space-y-4 max-w-[253px]">
            {/* <h3 className="text-[14px] tracking-[0.1em] font-medium text-[#444444] font-['Avenir_Next'] text-center">
              etoe hotel
            </h3> */}
            <div className="flex items-center space-x-3">
              {/* <Image
                src="/images/image6.png"
                alt="Hotel Image 1"
                width={40}
                height={40}
                className="rounded-lg"
              /> */}
              <Link
                href="https://www.instagram.com/etoe_tokyo"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/images/image7.png"
                  alt="Hotel Image 2"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              </Link>
            </div>
            <Link
              href="https://etoehotel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex justify-center items-center px-8 py-2 text-[13px] text-[#444444] border border-[#444444] rounded-full hover:bg-gray-50 font-zen-kaku-gothic tracking-[0.06em]"
            >
              公式サイトはこちら
            </Link>
          </div>

          <div className="text-center max-w-[188px]">
            <Link
              href="/commercial-transaction-law"
              className="text-[13px] text-[#444444] hover:text-gray-900 font-zen-kaku-gothic tracking-[0.06em]"
            >
              特定商取引法に基づく表記
            </Link>
            {/* <div className="mt-4">
              <Image
                src="/images/image23.png"
                alt="Footer Logo"
                width={188}
                height={40}
                className="w-auto h-10"
              />
            </div> */}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
